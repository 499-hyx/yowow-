#!/usr/bin/env python3
"""sync-to-db.py — 把本地 data/ + config/ 的 JSON 文件全量镜像到 Turso。

用法:
  python3 scripts/sync-to-db.py                # 同步到 Turso（需环境变量）
  python3 scripts/sync-to-db.py --dry-run      # 只列出将同步什么
  python3 scripts/sync-to-db.py --selftest     # 本地 sqlite 自测（/tmp，不碰网络）

环境变量（远程模式必需）:
  TURSO_DATABASE_URL   形如 libsql://<db>-<org>.turso.io（脚本自动转 https）
  TURSO_AUTH_TOKEN     Turso 数据库 token

原则:
  - 文件是唯一事实源。同步 = 全量 upsert + 按 kind 清理库里多余的 key（文件删了库里也删）。
  - feedback_inbox 不归本脚本管（那是网站写、pull-feedback.py 拉）。
  - 每天跑批/入池后跑一次本脚本，网站即更新。
"""
import argparse
import datetime
import json
import os
import sys
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (kind, 目录, key 的构造方式)
SOURCES = [
    ("account",            "data/accounts",            "flat"),    # key = 文件名去 .json
    ("today",              "data/today",               "twoLevel"),# key = <acct>/<date|latest>
    ("hotspots_broad",     "data/hotspots",            "flat"),
    ("hotspots_track",     "data/hotspots/tracks",     "twoLevel"),
    ("track_config",       "config/tracks",            "flat"),
    ("bridge_directions",  "config/bridge-directions", "flat"),
    ("platform",           "config/platforms",         "flat"),
    ("positioning",        "config/positionings",      "flat"),
    ("account_profile",    "config/account-profiles",  "flat"),
]


def collect():
    """收集全部 (kind, key, body)。损坏的 JSON 直接报错退出——不把坏数据镜像上去。"""
    rows = []
    for kind, rel, mode in SOURCES:
        root = os.path.join(BASE, rel)
        if not os.path.isdir(root):
            continue
        if mode == "flat":
            for f in sorted(os.listdir(root)):
                p = os.path.join(root, f)
                if not f.endswith(".json") or not os.path.isfile(p):
                    continue
                # hotspots_broad 目录下还有 tracks/ 子目录，flat 模式只收文件，天然跳过
                rows.append((kind, f[:-5], _read(p)))
        else:  # twoLevel: <root>/<a>/<b>.json → key = a/b
            for a in sorted(os.listdir(root)):
                sub = os.path.join(root, a)
                if not os.path.isdir(sub):
                    continue
                for f in sorted(os.listdir(sub)):
                    p = os.path.join(sub, f)
                    if not f.endswith(".json") or not os.path.isfile(p):
                        continue
                    if f.endswith(".bak.json") or f.endswith(".json.bak"):
                        continue
                    rows.append((kind, f"{a}/{f[:-5]}", _read(p)))
    return rows


def _read(p):
    with open(p, encoding="utf-8") as fh:
        body = fh.read()
    json.loads(body)  # 损坏即抛错
    return body


# ── 远程：Turso HTTP pipeline ─────────────────────────────────────────────

def turso_execute(url, token, statements):
    """statements: list[(sql, args)]，args 为 str 列表。一次 pipeline 提交。"""
    endpoint = url.replace("libsql://", "https://").rstrip("/") + "/v2/pipeline"
    requests_ = [
        {"type": "execute", "stmt": {
            "sql": sql,
            "args": [{"type": "text", "value": str(a)} for a in args],
        }}
        for sql, args in statements
    ] + [{"type": "close"}]
    payload = json.dumps({"requests": requests_}).encode("utf-8")
    req = urllib.request.Request(endpoint, data=payload, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read())
    for r in out.get("results", []):
        if r.get("type") == "error":
            raise RuntimeError(f"Turso 执行失败: {r}")
    return out


def schema_statements():
    schema = open(os.path.join(BASE, "db", "schema.sql"), encoding="utf-8").read()
    lines = []
    for line in schema.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        lines.append(line)
    return [(s.strip(), []) for s in "\n".join(lines).split(";") if s.strip()]


def sync_remote(rows):
    url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN")
    if not url or not token:
        sys.exit("缺少 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 环境变量。本地验证请用 --selftest。")
    now = datetime.datetime.now().isoformat(timespec="seconds")

    # 建表（幂等）
    turso_execute(url, token, schema_statements())

    # 分批 upsert（每批 40 条，避免单请求过大）
    upsert = ("INSERT INTO docs(kind, key, body, updated_at) VALUES (?, ?, ?, ?) "
              "ON CONFLICT(kind, key) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at")
    for i in range(0, len(rows), 40):
        batch = [(upsert, [k, key, body, now]) for k, key, body in rows[i:i + 40]]
        turso_execute(url, token, batch)

    # 清理：库里有、文件里没有的 key（按 kind）
    keys_by_kind = {}
    for k, key, _ in rows:
        keys_by_kind.setdefault(k, set()).add(key)
    for kind in [s[0] for s in SOURCES]:
        keys = keys_by_kind.get(kind, set())
        if keys:
            placeholders = ",".join(["?"] * len(keys))
            turso_execute(url, token, [(
                f"DELETE FROM docs WHERE kind = ? AND key NOT IN ({placeholders})",
                [kind, *sorted(keys)])])
        else:
            turso_execute(url, token, [("DELETE FROM docs WHERE kind = ?", [kind])])
    print(f"✅ 已同步 {len(rows)} 份文档到 Turso（{now}）")


# ── 自测：本地 sqlite（放 /tmp，挂载盘 sqlite 会 I/O error）──────────────

def selftest(rows):
    import sqlite3
    db = "/tmp/yowow-adaptation-sync-selftest.db"
    if os.path.exists(db):
        os.remove(db)
    conn = sqlite3.connect(db)
    conn.executescript(open(os.path.join(BASE, "db", "schema.sql"), encoding="utf-8").read())
    now = datetime.datetime.now().isoformat(timespec="seconds")
    conn.executemany(
        "INSERT INTO docs(kind,key,body,updated_at) VALUES (?,?,?,?) "
        "ON CONFLICT(kind,key) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at",
        [(k, key, body, now) for k, key, body in rows])
    conn.commit()
    n = conn.execute("SELECT COUNT(*) FROM docs").fetchone()[0]
    assert n == len(rows), f"行数不符: {n} != {len(rows)}"
    # 二次同步幂等
    conn.executemany(
        "INSERT INTO docs(kind,key,body,updated_at) VALUES (?,?,?,?) "
        "ON CONFLICT(kind,key) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at",
        [(k, key, body, now) for k, key, body in rows])
    conn.commit()
    assert conn.execute("SELECT COUNT(*) FROM docs").fetchone()[0] == len(rows), "二次同步不幂等"
    # 抽查一条能读回且是合法 JSON
    sample = conn.execute("SELECT body FROM docs WHERE kind='account' LIMIT 1").fetchone()
    if sample:
        json.loads(sample[0])
    conn.close()
    os.remove(db)
    kinds = {}
    for k, _, _ in rows:
        kinds[k] = kinds.get(k, 0) + 1
    print("✅ selftest 通过：", json.dumps(kinds, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    rows = collect()
    if args.selftest:
        selftest(rows)
    elif args.dry_run:
        for k, key, _ in rows:
            print(f"{k:18s} {key}")
        print(f"共 {len(rows)} 份")
    else:
        sync_remote(rows)


if __name__ == "__main__":
    main()
