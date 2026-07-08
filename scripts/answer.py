#!/usr/bin/env python3
"""
scripts/answer.py · 自动答题（方案③ · API 自动化）

把「读提示词 → 调大模型 → 写回贴」这一步自动化：
  读 data/runs/<date>/<account_id>/prompts/<step>-*.txt
  → 调 LLM（Anthropic messages API）
  → 抽 JSON（复用 prompt_loader.extract_json）
  → 写 data/runs/<date>/<account_id>/_inbox/<同名>.json
然后照常 ingest.py 安装。

用法:
  python3 scripts/answer.py <account_id> --date <YYYY-MM-DD> --step match
  python3 scripts/answer.py <account_id> --date <YYYY-MM-DD> --step generate
  python3 scripts/answer.py --selftest

设计边界：
  - 只答题、不发明流程：题目仍由 make-prompt.py 出，安装仍由 ingest.py 收口（禁词/5步/forced-hints 硬门照旧兜底）。
  - generate 步会把该赛道的分析层（prompts/分析提示词/<track_id>/赛道分析.md）作为 system 提示注入，
    让模型按赛道方法剖析——这正是「手工对照 赛道分析.md」的自动化等价。
  - 大模型配置全走环境变量，绝不写死：
      ANTHROPIC_API_KEY（必填）/ MODEL_NAME（默认 claude-sonnet-4-6）/ ANTHROPIC_BASE_URL（默认官方）。
  - 无 key → 报错退出，不伪造。
"""
import argparse
import datetime as _dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(PROJECT_ROOT)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
PROMPTS_DIR = os.path.join(PROJECT_ROOT, "prompts")

sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO_ROOT, "skills", "adaptation-engine"))
import prompt_loader as _pl  # extract_json
import cron_llm_email


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def account_track_id(account_id):
    p = os.path.join(DATA_DIR, "accounts", f"{account_id}.json")
    return (json.load(open(p, encoding="utf-8")) or {}).get("track_id")


def analysis_system_prompt(track_id):
    """赛道分析层提示词（generate 时作 system 注入）。缺省返回空串。"""
    if not track_id:
        return ""
    p = os.path.join(PROMPTS_DIR, "分析提示词", track_id, "赛道分析.md")
    return _read(p) if os.path.exists(p) else ""


def call_llm(system, user, *, _transport=None):
    """调配置的 LLM，返回纯文本。_transport 仅供自测注入。"""
    if _transport is not None:
        return _transport(system, user)
    return cron_llm_email.call_llm(system or "", user)


def answer_step(account_id, date_str, step, *, _transport=None):
    run_dir = os.path.join(DATA_DIR, "runs", date_str, account_id)
    prompts_dir = os.path.join(run_dir, "prompts")
    inbox = os.path.join(run_dir, "_inbox")
    if not os.path.isdir(prompts_dir):
        raise SystemExit(f"没有提示词目录：{prompts_dir}\n   先跑 make-prompt.py <account> --date {date_str} --step {step}")
    files = sorted(
        f for f in os.listdir(prompts_dir)
        if f.startswith(step + "-") and f.endswith(".txt")
    )
    if not files:
        raise SystemExit(f"prompts/ 里没有 {step}-*.txt，先跑 make-prompt.py --step {step}")

    system = analysis_system_prompt(account_track_id(account_id)) if step == "generate" else ""
    written = []
    total = len(files)
    for index, fn in enumerate(files, start=1):
        print(f"   [{index}/{total}] answering {fn} ...", flush=True)
        raw = call_llm(system, _read(os.path.join(prompts_dir, fn)), _transport=_transport)
        try:
            data = _pl.extract_json(raw)
        except Exception as e:
            raise SystemExit(f"{fn}: 模型回答里抽不出 JSON：{e}\n   回答开头：{raw[:200]}")
        out_name = fn[:-4] + ".json"   # match-<id>.txt -> match-<id>.json
        write_json(os.path.join(inbox, out_name), data)
        print(f"   [{index}/{total}] wrote _inbox/{out_name}", flush=True)
        written.append(out_name)
    return written


def selftest():
    print("--- answer.py --selftest ---")

    # 1) call_llm 走注入 transport，extract_json 能从带前后语的回答里抽出 JSON
    def fake(system, user):
        return '好的，下面是判断结果：\n```json\n{"tier":"skip","skip_reason":"跟教育连不上"}\n```\n以上。'
    out = call_llm("sys", "user", _transport=fake)
    data = _pl.extract_json(out)
    assert data["tier"] == "skip", "JSON 抽取失败"
    print("OK call_llm(transport) + extract_json")

    # 2) generate 步会注入赛道分析层 system（教育赛道存在 赛道分析.md）
    sysp = analysis_system_prompt("education-yowow")
    assert sysp and ("七步" in sysp or "分析" in sysp), "未注入教育赛道 analysis system"
    assert analysis_system_prompt("不存在的赛道") == "", "未知赛道应返回空 system"
    print("OK generate injects analysis system; unknown track falls back to empty")

    # 3) 无 key 时 call_llm 报错退出（不伪造）
    saved_provider = os.environ.get("LLM_PROVIDER")
    saved_key = os.environ.pop("ANTHROPIC_API_KEY", None)
    os.environ["LLM_PROVIDER"] = "anthropic"
    try:
        call_llm("s", "u")
        raise AssertionError("无 key 应当报错退出")
    except SystemExit:
        print("OK missing ANTHROPIC_API_KEY exits without faking output")
    finally:
        if saved_key is not None:
            os.environ["ANTHROPIC_API_KEY"] = saved_key
        if saved_provider is None:
            os.environ.pop("LLM_PROVIDER", None)
        else:
            os.environ["LLM_PROVIDER"] = saved_provider

    print("\nanswer.py --selftest passed")
    return 0


def main():
    ap = argparse.ArgumentParser(description="自动答题：读 prompts/*.txt → 调 LLM → 写 _inbox/*.json")
    ap.add_argument("account_id", nargs="?")
    ap.add_argument("--date", default=str(_dt.date.today()), metavar="YYYY-MM-DD")
    ap.add_argument("--step", choices=["match", "generate"], help="答哪一步")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        sys.exit(selftest())
    if not args.account_id or not args.step:
        ap.print_help()
        sys.exit(1)

    written = answer_step(args.account_id, args.date, args.step)
    print(f"✅ 已自动答题 {len(written)} 条 → data/runs/{args.date}/{args.account_id}/_inbox/")
    for n in written:
        print(f"   - {n}")
    print(f"\n下一步：python3 scripts/ingest.py {args.account_id} "
          f"data/runs/{args.date}/{args.account_id}/_inbox --date {args.date}")


if __name__ == "__main__":
    main()
