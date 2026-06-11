#!/usr/bin/env python3
"""pull-feedback.py — 把 Turso feedback_inbox 里同事打的分拉回本地文件。

用法:
  python3 scripts/pull-feedback.py             # 拉取未处理反馈 → 写本地文件并盖章 pulled_at
  python3 scripts/pull-feedback.py --selftest  # 本地 sqlite 自测（/tmp）

落地位置（与网站本地模式写文件一致）:
  data/runs/<date>/<account_id>/feedback-inbox/<feedback_id>-<hotspot_id>.json

之后照常用 ingest.py --feedback 归档/回流。每天跑批前跑一次本脚本即可。
"""
import datetime
import json
import os
import sys
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def turso(sql, args=()):
    url = os.environ.get("TURSO_DATABASE_URL", "").replace("libsql://", "https://").rstrip("/")
    token = os.environ.get("TURSO_AUTH_TOKEN", "")
    if not url or not token:
        sys.exit("缺少 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN。本地验证请用 --selftest。")
    payload = json.dumps({"requests": [
        {"type": "execute", "stmt": {"sql": sql, "args": [{"type": "text", "value": str(a)} for a in args]}},
        {"type": "close"}]}).encode()
    req = urllib.request.Request(f"{url}/v2/pipeline", data=payload, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read())
    first = out["results"][0]
    if first.get("type") == "error":
        raise RuntimeError(first)
    result = first["response"]["result"]
    cols = [c["name"] for c in result.get("cols", [])]
    return [dict(zip(cols, [c.get("value") for c in row])) for row in result.get("rows", [])]


def land(rows):
    """把反馈行写成本地文件，返回写入的 id 列表。"""
    landed = []
    for r in rows:
        try:
            record = json.loads(r["body"])
        except Exception:
            print(f"⚠️ 反馈 #{r['id']} body 不是合法 JSON，跳过（不盖章，下次人工看）")
            continue
        date, acct = record.get("date"), record.get("account_id")
        fid, hid = record.get("feedback_id", f"fb-{r['id']}"), record.get("hotspot_id", "unknown")
        if not date or not acct:
            print(f"⚠️ 反馈 #{r['id']} 缺 date/account_id，跳过")
            continue
        d = os.path.join(BASE, "data", "runs", date, acct, "feedback-inbox")
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, f"{fid}-{hid}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
        landed.append(r["id"])
        print(f"✔ {date} {acct} {hid} → {os.path.relpath(p, BASE)}")
    return landed


def main():
    if "--selftest" in sys.argv:
        import sqlite3
        db = "/tmp/yowow-pull-feedback-selftest.db"
        if os.path.exists(db):
            os.remove(db)
        conn = sqlite3.connect(db)
        conn.executescript(open(os.path.join(BASE, "db", "schema.sql"), encoding="utf-8").read())
        rec = {"feedback_id": "fb-test", "date": "2026-06-11", "account_id": "acct-selftest",
               "hotspot_id": "hs-x", "payload": {"can_publish": 5, "bridge_natural": 4, "angle_fit": 4}}
        conn.execute("INSERT INTO feedback_inbox (account_id, date, body, created_at) VALUES (?,?,?,?)",
                     ("acct-selftest", "2026-06-11", json.dumps(rec, ensure_ascii=False), "t"))
        conn.commit()
        rows = [dict(zip(["id", "body"], r)) for r in conn.execute(
            "SELECT id, body FROM feedback_inbox WHERE pulled_at IS NULL")]
        landed = land(rows)
        assert landed, "selftest 未落地任何反馈"
        # 清理 selftest 落的文件
        import shutil
        shutil.rmtree(os.path.join(BASE, "data", "runs", "2026-06-11", "acct-selftest"), ignore_errors=True)
        conn.close()
        os.remove(db)
        print("✅ selftest 通过")
        return

    rows = turso("SELECT id, body FROM feedback_inbox WHERE pulled_at IS NULL ORDER BY id")
    if not rows:
        print("没有新反馈。")
        return
    landed = land(rows)
    now = datetime.datetime.now().isoformat(timespec="seconds")
    for fid in landed:
        turso("UPDATE feedback_inbox SET pulled_at = ? WHERE id = ?", [now, fid])
    print(f"✅ 拉取 {len(landed)} 条反馈并盖章")


if __name__ == "__main__":
    main()
