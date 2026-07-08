#!/usr/bin/env python3
"""
scripts/status.py · 只读检查每日跑批状态。

检查的是 daily flow，不检查新赛道 bridge 接入状态。
不会写 data/today，也不会抓热点或生成内容。
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data"
CONFIG = ROOT / "config"
sys.path.insert(0, str(HERE))
import mvp_policy

APPROVED_STATUSES = {"approved", "reference"}
REQUIRED_TRACK_FIELDS = [
    "daily_search_question",
    "track_memory",
    "decision_layer",
    "analysis_layer",
    "output_channels",
]
REQUIRED_ACCOUNT_FIELDS = ["account_id", "track_id", "platform_id", "positioning_id"]
REQUIRED_PROMPT_TEMPLATES = [
    Path("分析提示词") / "热点匹配判断.md",
    Path("分析提示词") / "内容生成.md",
]


def read_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def list_json(directory):
    if not directory.exists():
        return []
    return sorted(p for p in directory.iterdir() if p.suffix == ".json")


def load_tracks():
    tracks = []
    for path in list_json(CONFIG / "tracks"):
        data = read_json(path)
        data["_path"] = path
        tracks.append(data)
    return tracks


def load_accounts():
    accounts = []
    for path in list_json(DATA / "accounts"):
        data = read_json(path)
        data["_path"] = path
        accounts.append(data)
    return accounts


def load_account(account_id):
    path = DATA / "accounts" / f"{account_id}.json"
    if not path.exists():
        return None, path
    data = read_json(path)
    data["_path"] = path
    return data, path


def load_track(track_id):
    path = CONFIG / "tracks" / f"{track_id}.json"
    if not path.exists():
        return None, path
    data = read_json(path)
    data["_path"] = path
    return data, path


def exists(path):
    return path.exists()


def has_any(directory, prefix):
    if not directory.exists():
        return False
    return any(p.is_file() and p.name.startswith(prefix) for p in directory.iterdir())


def has_run_artifact(run_dir, prefix):
    return (
        has_any(run_dir / "_inbox", prefix)
        or has_any(run_dir / "raw", prefix)
        or has_any(run_dir / "prompts", prefix)
    )


def smoke_note(track):
    if not track:
        return None
    direct = track.get("smoke_note") or track.get("temporary_smoke_note")
    if direct:
        return str(direct)
    if track.get("smoke_only") is True:
        return "smoke_only=true"
    for field in REQUIRED_TRACK_FIELDS:
        value = track.get(field)
        if isinstance(value, dict) and value.get("smoke_only") is True:
            return f"{field}.smoke_only=true"
    return None


def account_exists_on_date(account, date_str):
    """New accounts should not make old historical dates look broken."""
    created_at = account.get("created_at")
    if not created_at:
        return True
    try:
        created_date = dt.date.fromisoformat(str(created_at)[:10])
        target_date = dt.date.fromisoformat(date_str)
    except ValueError:
        return True
    return created_date <= target_date


def check_preflight(date_str, account_id):
    issues = []
    ok = []

    account, account_path = load_account(account_id)
    if not account:
        return [], [f"账号文件不存在: {account_path.relative_to(ROOT)}"]
    ok.append(f"账号文件存在: {account_path.relative_to(ROOT)}")

    missing_account_fields = [field for field in REQUIRED_ACCOUNT_FIELDS if not account.get(field)]
    if missing_account_fields:
        issues.append(f"账号 {account_id} 缺必要字段: {', '.join(missing_account_fields)}")
    else:
        ok.append(f"账号必要字段完整: {account_id}")

    ok.append(f"账号可运行: {account_id}（账号 status 字段不再作为跑批开关）")

    track_id = account.get("track_id")
    track, track_path = load_track(track_id) if track_id else (None, CONFIG / "tracks" / "<missing>.json")
    if not track:
        issues.append(f"赛道文件不存在: {track_path.relative_to(ROOT)}")
    else:
        ok.append(f"赛道文件存在: {track_path.relative_to(ROOT)}")
        track_status = track.get("status") or "draft"
        note = smoke_note(track)
        if track_status in APPROVED_STATUSES:
            if note:
                ok.append(
                    f"赛道临时可运行: {track_id} status={track_status} "
                    f"(SMOKE ONLY; not formal approval; {note})"
                )
            else:
                ok.append(f"赛道可运行: {track_id} status={track_status}")
        else:
            ok.append(
                f"赛道工程可运行（内部产物标记）: {track_id} status={track_status} "
                f"(MVP internal; needs_human_review=true; formal_approval=false)"
            )

        missing_track_fields = [field for field in REQUIRED_TRACK_FIELDS if not track.get(field)]
        if missing_track_fields:
            issues.append(f"赛道 {track_id} 缺必要字段: {', '.join(missing_track_fields)}")
        else:
            ok.append(f"赛道必要字段完整: {track_id}")

    broad = DATA / "hotspots" / f"{date_str}.json"
    if exists(broad):
        ok.append(f"公共热点池存在: {broad.relative_to(ROOT)}")
    else:
        issues.append(f"缺当天公共热点池: {broad.relative_to(ROOT)}")

    if track_id:
        track_pool = DATA / "hotspots" / "tracks" / track_id / f"{date_str}.json"
        if exists(track_pool):
            ok.append(f"赛道池存在: {track_pool.relative_to(ROOT)}")
        else:
            issues.append(f"缺赛道池 {track_id}: {track_pool.relative_to(ROOT)}")

    for template in REQUIRED_PROMPT_TEMPLATES:
        path = ROOT / "prompts" / template
        if exists(path):
            ok.append(f"prompt 模板存在: {path.relative_to(ROOT)}")
        else:
            issues.append(f"缺 prompt 模板: {path.relative_to(ROOT)}")

    return ok, issues


def check(date_str):
    issues = []
    ok = []

    broad = DATA / "hotspots" / f"{date_str}.json"
    if exists(broad):
        ok.append(f"公共热点池存在: {broad.relative_to(ROOT)}")
    else:
        issues.append(f"缺当天公共热点池: {broad.relative_to(ROOT)}")

    accounts = [a for a in load_accounts() if account_exists_on_date(a, date_str)]
    account_track_ids = {a.get("track_id") for a in accounts if a.get("track_id")}
    tracks = [
        t for t in load_tracks()
        if (t.get("status") or "draft") in APPROVED_STATUSES or t.get("track_id") in account_track_ids
    ]

    for track in tracks:
        track_id = track.get("track_id")
        label = track.get("track_name") or track_id
        missing = [field for field in REQUIRED_TRACK_FIELDS if not track.get(field)]
        if missing:
            issues.append(f"赛道 {track_id} 缺必要字段: {', '.join(missing)}")
        else:
            ok.append(f"赛道配置完整: {track_id}")
        warning = mvp_policy.track_warning(track)
        if warning:
            ok.append(warning)

        track_pool = DATA / "hotspots" / "tracks" / track_id / f"{date_str}.json"
        if exists(track_pool):
            ok.append(f"赛道池存在: {track_pool.relative_to(ROOT)}")
        else:
            issues.append(f"缺赛道池 {label}: {track_pool.relative_to(ROOT)}")

        channel_ids = set(track.get("output_channels") or [])
        track_accounts = [
            a for a in accounts
            if a.get("track_id") == track_id and (not channel_ids or a.get("account_id") in channel_ids)
        ]
        if not track_accounts:
            issues.append(f"赛道 {track_id} 没有发布账号")

        for account in track_accounts:
            account_id = account.get("account_id")
            run_dir = DATA / "runs" / date_str / account_id
            if has_run_artifact(run_dir, "match-"):
                ok.append(f"赛道判断存在: data/runs/{date_str}/{account_id}/")
            else:
                issues.append(
                    f"缺赛道/账号判断输出: data/runs/{date_str}/{account_id}/prompts/match-*.txt "
                    f"或 _inbox/match-*.json"
                )

            if has_run_artifact(run_dir, "generate-") or exists(run_dir / "installed.json"):
                ok.append(f"赛道分析/安装材料存在: data/runs/{date_str}/{account_id}/")
            else:
                issues.append(
                    f"缺赛道/账号分析输出: data/runs/{date_str}/{account_id}/prompts/generate-*.txt "
                    f"或 _inbox/generate-*.json 或 installed.json"
                )

            dated = DATA / "today" / account_id / f"{date_str}.json"
            latest = DATA / "today" / account_id / "latest.json"
            if exists(dated):
                ok.append(f"today dated 存在: {dated.relative_to(ROOT)}")
            else:
                issues.append(f"缺前端 dated 输出: {dated.relative_to(ROOT)}")
            if exists(latest):
                ok.append(f"today latest 存在: {latest.relative_to(ROOT)}")
            else:
                issues.append(f"缺前端 latest 输出: {latest.relative_to(ROOT)}")

    return ok, issues


def main():
    parser = argparse.ArgumentParser(description="检查每日跑批状态，不检查新赛道 bridge 状态。")
    parser.add_argument("--date", default=str(dt.date.today()), help="YYYY-MM-DD，默认今天")
    parser.add_argument(
        "--preflight",
        metavar="ACCOUNT_ID",
        help="只检查指定账号 fresh-run 启动前必须存在的输入，不要求跑中/跑后产物。",
    )
    args = parser.parse_args()

    if args.preflight:
        ok, issues = check_preflight(args.date, args.preflight)
        print(f"Preflight status for {args.preflight} on {args.date}")
    else:
        ok, issues = check(args.date)
        print(f"Daily status for {args.date}")

    print("\nOK:")
    for item in ok:
        print(f"  ✓ {item}")
    if not ok:
        print("  (none)")

    print("\nMissing / action needed:")
    for item in issues:
        print(f"  - {item}")
    if not issues:
        print("  (none)")

    raise SystemExit(1 if issues else 0)


if __name__ == "__main__":
    main()
