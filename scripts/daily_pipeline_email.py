#!/usr/bin/env python3
"""Run the daily local pipeline and email the resulting recommendation digest.

Pipeline:
  hotspot pool check -> preflight -> make match prompts -> LLM answer match
  -> make generate prompts -> LLM answer generate -> ingest
  -> latest-file smoke check -> email.

The script assumes hotspot JSON files already exist for the target date. Hotspot
pool generation is intentionally manual by default; pass --generate-hotspots only
when explicitly authorizing the LLM-backed hotspot pool helper. To mirror results
to production Turso, pass --sync-to-db after explicitly authorizing that
environment.
"""
import argparse
import datetime as dt
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, "data")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import cron_llm_email
import generate_hotspot_pool


def write_line(text):
    sys.stdout.write(text + "\n")


def split_csv(value):
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def load_accounts():
    accounts_dir = os.path.join(DATA_DIR, "accounts")
    account_ids = []
    for name in sorted(os.listdir(accounts_dir)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(accounts_dir, name), encoding="utf-8") as fh:
            account = json.load(fh)
        account_ids.append(account.get("account_id") or name[:-5])
    return account_ids


def account_track_id(account_id):
    path = os.path.join(DATA_DIR, "accounts", f"{account_id}.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh).get("track_id")


def require_hotspot_pool(account_id, date_str):
    broad = os.path.join(DATA_DIR, "hotspots", f"{date_str}.json")
    track_id = account_track_id(account_id)
    track = os.path.join(DATA_DIR, "hotspots", "tracks", track_id or "", f"{date_str}.json")
    if os.path.exists(broad) or os.path.exists(track):
        return
    raise SystemExit(
        f"Missing hotspot pool for {account_id} on {date_str}. "
        f"Expected {broad} or {track}."
    )


def run_cmd(args, *, dry_run=False):
    write_line("$ " + " ".join(args))
    if dry_run:
        return
    result = subprocess.run(
        args,
        cwd=BASE,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={
            **os.environ,
            "PYTHONIOENCODING": "utf-8",
        },
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def smoke_latest(account_id, date_str):
    latest = os.path.join(DATA_DIR, "today", account_id, "latest.json")
    dated = os.path.join(DATA_DIR, "today", account_id, f"{date_str}.json")
    if not os.path.exists(latest):
        raise SystemExit(f"Missing latest after ingest: {latest}")
    if not os.path.exists(dated):
        raise SystemExit(f"Missing dated today file after ingest: {dated}")
    with open(latest, encoding="utf-8") as fh:
        data = json.load(fh)
    board = data.get("board") or {}
    picks = board.get("picks") or []
    skipped = board.get("skipped") or []
    write_line(f"front-end data check: {account_id} picks={len(picks)} skipped={len(skipped)}")


def run_account(account_id, date_str, *, dry_run=False, generate_hotspots=False):
    write_line(f"\n=== {account_id} / {date_str} ===")
    if generate_hotspots:
        generate_hotspot_pool.generate_pools(account_id, date_str, dry_run=dry_run)
    if not dry_run:
        require_hotspot_pool(account_id, date_str)
    run_cmd([sys.executable, "scripts/status.py", "--date", date_str, "--preflight", account_id], dry_run=dry_run)
    run_cmd([sys.executable, "scripts/make-prompt.py", account_id, "--date", date_str, "--step", "match", "--no-print"], dry_run=dry_run)
    run_cmd([sys.executable, "scripts/answer.py", account_id, "--date", date_str, "--step", "match"], dry_run=dry_run)
    run_cmd([sys.executable, "scripts/make-prompt.py", account_id, "--date", date_str, "--step", "generate", "--no-print"], dry_run=dry_run)
    run_cmd([sys.executable, "scripts/answer.py", account_id, "--date", date_str, "--step", "generate"], dry_run=dry_run)
    inbox = os.path.join("data", "runs", date_str, account_id, "_inbox")
    run_cmd([sys.executable, "scripts/ingest.py", account_id, inbox, "--date", date_str], dry_run=dry_run)
    if not dry_run:
        smoke_latest(account_id, date_str)


def send_digest(date_str, account_ids, *, dry_run=False):
    boards = cron_llm_email.load_latest_boards(account_ids)
    email = cron_llm_email.build_email(date_str, boards, use_llm=not dry_run)
    if dry_run:
        write_line("\n=== email dry-run ===")
        write_line("Subject: " + email["subject"])
        write_line("")
        write_line(email["body_text"])
        return
    cron_llm_email.send_email(email["subject"], email["body_text"])
    write_line(f"sent digest email to {os.environ.get('EMAIL_TO')}")


def selftest():
    assert split_csv("a,b, c") == ["a", "b", "c"]
    accounts = load_accounts()
    assert accounts, "expected at least one account fixture"
    assert account_track_id(accounts[0]), "expected account track_id"
    write_line("daily_pipeline_email.py --selftest passed")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Run daily yowow pipeline and email a digest.")
    parser.add_argument("--date", default=str(dt.date.today()), help="YYYY-MM-DD, default: today")
    parser.add_argument("--accounts", help="Comma-separated account IDs. Default: DAILY_PIPELINE_ACCOUNTS or all accounts.")
    parser.add_argument("--email-to", help="Override EMAIL_TO for this run.")
    parser.add_argument("--dry-run", action="store_true", help="Print commands and email preview; do not call LLM or SMTP.")
    parser.add_argument("--skip-pipeline", action="store_true", help="Only build/send email from existing latest.json files.")
    parser.add_argument("--generate-hotspots", action="store_true", help="Ask LLM to generate hotspot pools before running match/generate. Manual hotspot pools are the default.")
    parser.add_argument("--skip-hotspot-generation", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--sync-to-db", action="store_true", help="After ingest, run sync-to-db.py. Use only with authorized Turso env.")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        sys.exit(selftest())

    if args.email_to:
        os.environ["EMAIL_TO"] = args.email_to

    account_ids = split_csv(args.accounts or os.environ.get("DAILY_PIPELINE_ACCOUNTS")) or load_accounts()
    write_line(f"daily pipeline date={args.date} accounts={','.join(account_ids)}")

    if not args.skip_pipeline:
        for account_id in account_ids:
            run_account(
                account_id,
                args.date,
                dry_run=args.dry_run,
                generate_hotspots=args.generate_hotspots and not args.skip_hotspot_generation,
            )
        if args.sync_to_db:
            run_cmd([sys.executable, "scripts/sync-to-db.py", "--dry-run"], dry_run=args.dry_run)
            run_cmd([sys.executable, "scripts/sync-to-db.py"], dry_run=args.dry_run)

    send_digest(args.date, account_ids, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
