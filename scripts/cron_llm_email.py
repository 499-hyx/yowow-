#!/usr/bin/env python3
"""Cron entrypoint: summarize latest local boards with an LLM and email the result.

This script is intentionally outside the Next.js app. It belongs to the local
operations lane: crond calls it, it reads data/ as the source of truth, calls an
LLM API, and sends an SMTP email. It does not write Turso and does not run in
Vercel.
"""
import argparse
import datetime as dt
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.request
from email.message import EmailMessage

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, "data")

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def write_line(text):
    sys.stdout.write(text + "\n")


def split_csv(value):
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def first_present(*values, default=""):
    for value in values:
        if value is not None and value != "":
            return value
    return default


def first_env(*names):
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return None


def pick_text(pick):
    content = pick.get("content") or {}
    return {
        "hotspot_id": pick.get("hotspot_id"),
        "recommendation": pick.get("recommendation"),
        "title": first_present(content.get("title"), content.get("topic"), default=""),
        "topic": content.get("topic") or "",
        "body_preview": (content.get("body_or_script") or "")[:500],
        "risk_note": pick.get("risk_note") or "",
        "needs_human_review": bool(pick.get("needs_human_review")),
        "mvp_internal_only": bool(pick.get("mvp_internal_only")),
    }


def load_latest_boards(account_ids=None, max_picks_per_account=3):
    account_filter = set(account_ids or [])
    accounts_dir = os.path.join(DATA_DIR, "accounts")
    today_dir = os.path.join(DATA_DIR, "today")
    if not os.path.isdir(accounts_dir):
        raise SystemExit(f"Missing accounts dir: {accounts_dir}")

    boards = []
    for name in sorted(os.listdir(accounts_dir)):
        if not name.endswith(".json"):
            continue
        account = read_json(os.path.join(accounts_dir, name))
        account_id = account.get("account_id") or name[:-5]
        if account_filter and account_id not in account_filter:
            continue
        latest_path = os.path.join(today_dir, account_id, "latest.json")
        if not os.path.exists(latest_path):
            boards.append({
                "account_id": account_id,
                "display_name": account.get("display_name") or account_id,
                "track_id": account.get("track_id"),
                "platform_id": account.get("platform_id"),
                "status": "missing_latest",
                "picks": [],
            })
            continue
        latest = read_json(latest_path)
        latest_account = latest.get("account") or account
        picks = (latest.get("board") or {}).get("picks") or []
        keep = []
        for pick in picks:
            if pick.get("recommendation") == "skip":
                continue
            keep.append(pick_text(pick))
            if len(keep) >= max_picks_per_account:
                break
        boards.append({
            "account_id": account_id,
            "display_name": latest_account.get("display_name") or account.get("display_name") or account_id,
            "track_id": latest_account.get("track_id") or account.get("track_id"),
            "platform_id": latest_account.get("platform_id") or account.get("platform_id"),
            "status": "ok",
            "picks": keep,
        })
    return boards


def extract_json(text):
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fenced:
        return json.loads(fenced.group(1))
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM response did not contain a JSON object")
    return json.loads(text[start:end + 1])


def call_anthropic(system, user, transport=None):
    if transport is not None:
        return transport("anthropic", system, user)
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise SystemExit("Missing ANTHROPIC_API_KEY")
    model = os.environ.get("MODEL_NAME") or DEFAULT_ANTHROPIC_MODEL
    base = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
    payload = {
        "model": model,
        "max_tokens": int(os.environ.get("LLM_MAX_TOKENS", "2500")),
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    req = urllib.request.Request(
        base + "/v1/messages",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=int(os.environ.get("LLM_TIMEOUT_SECONDS", "120"))) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")


def call_openai_compatible(system, user, *, provider="openai", transport=None):
    if transport is not None:
        return transport(provider, system, user)
    key = first_env("OPENAI_API_KEY", "DOUBAO_API_KEY", "ARK_API_KEY", "LLM_API_KEY", "API_KEY")
    if not key:
        raise SystemExit("Missing OPENAI_API_KEY / DOUBAO_API_KEY / ARK_API_KEY / LLM_API_KEY")
    model = os.environ.get("MODEL_NAME")
    if not model:
        raise SystemExit(f"Missing MODEL_NAME for LLM_PROVIDER={provider}")
    default_base = DEFAULT_ARK_BASE_URL if provider in ("doubao", "ark") else "https://api.openai.com/v1"
    base = first_env("OPENAI_BASE_URL", "DOUBAO_BASE_URL", "ARK_BASE_URL") or default_base
    base = base.rstrip("/")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": int(os.environ.get("LLM_MAX_TOKENS", "2500")),
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=int(os.environ.get("LLM_TIMEOUT_SECONDS", "120"))) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def call_llm(system, user, transport=None):
    provider = os.environ.get("LLM_PROVIDER", "anthropic").strip().lower()
    if provider == "anthropic":
        return call_anthropic(system, user, transport=transport)
    if provider in ("openai", "openai-compatible", "doubao", "ark"):
        return call_openai_compatible(system, user, provider=provider, transport=transport)
    raise SystemExit(f"Unsupported LLM_PROVIDER: {provider}")


def build_llm_messages(run_date, boards):
    system = (
        "你是 yowow-adaptation 内部内容预案台的运营秘书。"
        "你的任务是把本地 data/today/latest.json 中的候选内容整理成一封可读邮件。"
        "只总结已有数据，不编造热点、账号或结论。"
        "如果发现 needs_human_review 或 mvp_internal_only，要明确提醒人工复核。"
        "最终只输出 JSON 对象，字段为 subject 和 body_text。"
    )
    user = {
        "date": run_date,
        "boards": boards,
        "output_contract": {
            "subject": "不超过 40 个中文字符的邮件标题",
            "body_text": "纯文本邮件正文，包含：总览、各账号推荐、需要复核、下一步动作",
        },
    }
    return system, json.dumps(user, ensure_ascii=False, indent=2)


def render_fallback_email(run_date, boards):
    lines = [f"YOWOW 每日内容摘要 - {run_date}", ""]
    for board in boards:
        lines.append(f"账号：{board['display_name']} ({board['account_id']})")
        if board["status"] != "ok":
            lines.append("  - 今天还没有 latest.json，需要先跑批。")
            lines.append("")
            continue
        if not board["picks"]:
            lines.append("  - 暂无可推荐内容。")
            lines.append("")
            continue
        for pick in board["picks"]:
            flags = []
            if pick["needs_human_review"]:
                flags.append("需人工复核")
            if pick["mvp_internal_only"]:
                flags.append("内部 MVP")
            suffix = f" [{' / '.join(flags)}]" if flags else ""
            lines.append(f"  - {pick['recommendation']}: {pick['title']}{suffix}")
        lines.append("")
    return {
        "subject": f"YOWOW 每日内容摘要 {run_date}",
        "body_text": "\n".join(lines).strip() + "\n",
    }


def build_email(run_date, boards, transport=None, use_llm=True):
    if not use_llm:
        return render_fallback_email(run_date, boards)
    system, user = build_llm_messages(run_date, boards)
    raw = call_llm(system, user, transport=transport)
    data = extract_json(raw)
    subject = str(data.get("subject") or "").strip()
    body = str(data.get("body_text") or "").strip()
    if not subject or not body:
        raise ValueError("LLM JSON must contain non-empty subject and body_text")
    return {"subject": subject, "body_text": body + "\n"}


def smtp_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def send_email(subject, body_text):
    host = os.environ.get("SMTP_HOST")
    to_addrs = split_csv(os.environ.get("EMAIL_TO"))
    from_addr = os.environ.get("EMAIL_FROM") or os.environ.get("SMTP_USERNAME")
    if not host:
        raise SystemExit("Missing SMTP_HOST")
    if not to_addrs:
        raise SystemExit("Missing EMAIL_TO")
    if not from_addr:
        raise SystemExit("Missing EMAIL_FROM or SMTP_USERNAME")

    msg = EmailMessage()
    prefix = os.environ.get("EMAIL_SUBJECT_PREFIX", "[YOWOW]")
    msg["Subject"] = f"{prefix} {subject}".strip()
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_addrs)
    msg.set_content(body_text)

    port = int(os.environ.get("SMTP_PORT", "465" if smtp_bool("SMTP_USE_SSL") else "587"))
    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    if smtp_bool("SMTP_USE_SSL"):
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as smtp:
            if username or password:
                smtp.login(username or "", password or "")
            return smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            if smtp_bool("SMTP_USE_TLS", default=True):
                smtp.starttls(context=ssl.create_default_context())
            if username or password:
                smtp.login(username or "", password or "")
            return smtp.send_message(msg)


def smtp_test():
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    subject = f"SMTP test {stamp}"
    body = (
        "This is a YOWOW SMTP delivery test.\n"
        "If you received this message, SMTP authentication and basic delivery work.\n"
        f"Timestamp: {stamp}\n"
    )
    refused = send_email(subject, body)
    if refused:
        raise SystemExit(f"SMTP refused recipients: {refused}")
    write_line(f"SMTP test accepted by server. Search Gmail for: {subject}")


def selftest():
    boards = [{
        "account_id": "acct-demo",
        "display_name": "Demo Account",
        "track_id": "demo-track",
        "platform_id": "douyin",
        "status": "ok",
        "picks": [{
            "hotspot_id": "hs-demo",
            "recommendation": "strong_pick",
            "title": "测试标题",
            "topic": "测试主题",
            "body_preview": "测试正文",
            "risk_note": "",
            "needs_human_review": True,
            "mvp_internal_only": False,
        }],
    }]

    seen_providers = []

    def fake(provider, system, user):
        seen_providers.append(provider)
        assert "最终只输出 JSON" in system
        assert "acct-demo" in user
        return '```json\n{"subject":"今日测试摘要","body_text":"1 条内容需要复核"}\n```'

    saved_provider = os.environ.get("LLM_PROVIDER")
    os.environ["LLM_PROVIDER"] = "anthropic"
    try:
        email = build_email("2099-01-01", boards, transport=fake)
        assert email["subject"] == "今日测试摘要"
        assert "复核" in email["body_text"]
        os.environ["LLM_PROVIDER"] = "doubao"
        email = build_email("2099-01-01", boards, transport=fake)
        assert email["subject"] == "今日测试摘要"
        assert seen_providers == ["anthropic", "doubao"], f"unexpected providers: {seen_providers}"
        fallback = build_email("2099-01-01", boards, use_llm=False)
        assert "Demo Account" in fallback["body_text"]
        assert "需人工复核" in fallback["body_text"]
        write_line("cron_llm_email.py --selftest passed")
        return 0
    finally:
        if saved_provider is None:
            os.environ.pop("LLM_PROVIDER", None)
        else:
            os.environ["LLM_PROVIDER"] = saved_provider


def main():
    parser = argparse.ArgumentParser(description="Generate an LLM digest from data/today/latest.json and email it.")
    parser.add_argument("--date", default=str(dt.date.today()), help="Digest date label, default: today")
    parser.add_argument("--accounts", help="Comma-separated account_id list. Default: all accounts.")
    parser.add_argument("--max-picks", type=int, default=3, help="Max non-skip picks per account.")
    parser.add_argument("--dry-run", action="store_true", help="Print the email and do not send SMTP.")
    parser.add_argument("--no-llm", action="store_true", help="Render a deterministic fallback email without calling LLM.")
    parser.add_argument("--smtp-test", action="store_true", help="Send a minimal SMTP test email without LLM or project data.")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        sys.exit(selftest())
    if args.smtp_test:
        smtp_test()
        return

    boards = load_latest_boards(split_csv(args.accounts), max_picks_per_account=args.max_picks)
    email = build_email(args.date, boards, use_llm=not args.no_llm)

    if args.dry_run:
        write_line("Subject: " + email["subject"])
        write_line("")
        write_line(email["body_text"])
        return

    refused = send_email(email["subject"], email["body_text"])
    if refused:
        raise SystemExit(f"SMTP refused recipients: {refused}")
    write_line(f"Sent cron LLM email to {os.environ.get('EMAIL_TO')}")


if __name__ == "__main__":
    main()
