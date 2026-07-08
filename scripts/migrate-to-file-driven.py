#!/usr/bin/env python3
"""migrate-to-file-driven.py
把 config/ 的种子数据装配成 data/ 目录下的运行数据。
只需首次（或重置时）跑一次。不删 config/（保留原始素材）。

运行：
  cd yowow-adaptation
  python3 scripts/migrate-to-file-driven.py
"""
import json
import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent   # yowow-adaptation/
CONFIG_DIR = BASE_DIR / "config"
DATA_DIR   = BASE_DIR / "data"

# ── 工具 ──────────────────────────────────────────────────────────────

def rj(p: Path):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def wj(p: Path, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {p.relative_to(BASE_DIR)}")

def list_json(subdir: str):
    d = CONFIG_DIR / subdir
    return sorted(d.glob("*.json")) if d.exists() else []

# ── 出口用词硬门（与 adaptation-types.ts INTERNAL_OR_SCORE 同源）────

INTERNAL_TERMS = [
    "远迁移", "far transfer", "OOD", "in-distribution", "范式转移",
    "relevance", "naturalness", "相关度分", "自然度分",
]

def scan_internal(text: str) -> list:
    low = text.lower()
    return [w for w in INTERNAL_TERMS
            if (w in text if not all(ord(c) < 128 for c in w) else w.lower() in low)]

def visible_strings(output: dict) -> list:
    out = []
    for p in output.get("bridge_paths", []):
        for k in ["phenomenon", "real_problem", "track_relation",
                  "product_value_support", "platform_expression"]:
            if p.get(k): out.append(p[k])
    c = output.get("content") or {}
    for k in ["topic", "title", "body_or_script"]:
        if c.get(k): out.append(c[k])
    if output.get("skip_reason"): out.append(output["skip_reason"])
    return out

def gate_visible(output: dict, track: dict, extra_forbidden: list = None) -> dict:
    forbidden = list(track.get("bridge", {}).get("forbidden_terms", []))
    if extra_forbidden:
        forbidden.extend(extra_forbidden)
    hit = any(
        scan_internal(s) or any(w and w in s for w in forbidden)
        for s in visible_strings(output)
    )
    if not hit:
        return output
    return {
        **output,
        "recommendation": "skip",
        "skip_reason": "这条成品没过用词自检，先不给你看，点「重新生成」再试一次。",
        "bridge_paths": [],
        "chosen_path_id": None,
        "content": None,
        "external_terms_check": False,
    }

# ── meta（历史迁移用内置装配逻辑；当前今日结果以 ingest.py 为准）──────────────

def build_meta(output: dict, hotspot_title: str, track: dict) -> dict:
    paths = output.get("bridge_paths", [])
    chosen_id = output.get("chosen_path_id")
    chosen = next((p for p in paths if p.get("path_id") == chosen_id), None) \
             or (paths[0] if paths else None)

    one_liner = (
        hotspot_title
        or (chosen.get("phenomenon") if chosen else None)
        or (output.get("skip_reason", "").split("，")[0] if output.get("skip_reason") else None)
        or output.get("hotspot_id", "")
    )

    rec = output.get("recommendation", "skip")
    if rec == "strong_pick":
        vocab  = track.get("bridge", {}).get("external_vocab", [])
        anchor = "、".join(vocab[:2])
        if chosen:
            anchor_str = f"，正好接你的「{anchor}」" if anchor else ""
            reason = f"这条戳的是「{chosen['real_problem']}」{anchor_str}，可以直接发。"
        else:
            reason = "今天最适合你的一条，可以直接发。"
    elif rec == "maybe":
        reason = f"能接得上，但角度要自己挑，给你 {len(paths)} 条讲法参考。"
    else:
        reason = output.get("skip_reason") or "这条跟你的号连不上，硬蹭会伤号，帮你跳过了。"

    return {"oneLiner": one_liner, "reason": reason}

# ── to_board（历史迁移用内置装配逻辑；当前今日结果以 ingest.py 为准）───────────

def to_board(outputs: list) -> dict:
    def rec_rank(r):
        return 0 if r == "strong_pick" else 1

    def rank_score(o):
        return 0.5 * o.get("relevance_score", 0) + 0.5 * o.get("naturalness_score", 0)

    non_skip = [o for o in outputs if o.get("recommendation") != "skip"]
    non_skip.sort(key=lambda o: (rec_rank(o.get("recommendation", "skip")), -rank_score(o)))

    skipped = [o for o in outputs if o.get("recommendation") == "skip"]

    def strip(o):
        return {k: v for k, v in o.items() if k not in ("relevance_score", "naturalness_score")}

    return {
        "picks":    [strip(o) for o in non_skip],
        "also_ran": [],
        "skipped":  [strip(o) for o in skipped],
    }

# ── 账号 StoredAccount 装配（历史迁移用，日常账号事实源是 data/accounts/）──

def human_forbidden(terms: list) -> list:
    return [t for t in terms if not scan_internal(t)]

def build_stored_account(acct_path: Path) -> dict:
    acct = rj(acct_path)
    track_p  = CONFIG_DIR / "tracks" / f"{acct['track_id']}.json"
    plat_p   = CONFIG_DIR / "platforms" / f"{acct['platform_id']}.json"
    pos_p    = CONFIG_DIR / "positionings" / f"{acct['positioning_id']}.json"
    bd_p     = CONFIG_DIR / "bridge-directions" / f"{acct['track_id']}.json"

    track    = rj(track_p)   if track_p.exists()  else {}
    platform = rj(plat_p)    if plat_p.exists()   else {}
    pos      = rj(pos_p)     if pos_p.exists()    else {}
    bd       = rj(bd_p)["directions"] if bd_p.exists() else []

    ov       = acct.get("overrides", {})
    hft      = human_forbidden(track.get("bridge", {}).get("forbidden_terms", []))

    return {
        "account_id":        acct["account_id"],
        "tenant_id":         acct["tenant_id"],
        "display_name":      acct["display_name"],
        "track_id":          acct["track_id"],
        "platform_id":       acct["platform_id"],
        "positioning_id":    acct["positioning_id"],
        "platform_name":     platform.get("platform_name", acct["platform_id"]),
        "positioning_name":  pos.get("positioning_name", acct["positioning_id"]),
        "track_name":        track.get("track_name"),
        "created_at":        acct.get("created_at"),
        "memory_updated_at": None,
        "memory": {
            "business":              track.get("buyer", {}).get("business"),
            "audience":              track.get("audience"),
            "product_value":         track.get("product_value"),
            "anxiety_anchors":       track.get("anxiety_anchors", []),
            "proof_assets":          track.get("proof_assets", []),
            "commercial_goal":       track.get("commercial_goal", []),
            "content_style":         ov.get("tone_note"),
            "extra_external_vocab":  ov.get("extra_external_vocab", []),
            "extra_forbidden_terms": ov.get("extra_forbidden_terms", []),
            "banned_topics":         ov.get("banned_topics", []),
            "understood": {
                "business_understood": track.get("buyer", {}).get("business", ""),
                "goal_understood":     "、".join(track.get("commercial_goal", [])),
                "external_vocab":      track.get("bridge", {}).get("external_vocab", []),
                "forbidden_terms":     hft + ov.get("extra_forbidden_terms", []),
            },
        },
    }

# ── 今日推荐 TodayResponse 装配 ──────────────────────────────────────

def build_today_response(sa: dict, today: str) -> dict:
    """从 warm-start 回放产物装配 TodayResponse。"""
    track_id      = sa["track_id"]
    platform_id   = sa["platform_id"]
    positioning_id= sa["positioning_id"]
    account_id    = sa["account_id"]

    warm_dir = CONFIG_DIR / "warm-start"
    prefix   = f"{track_id}__{platform_id}__{positioning_id}__"
    seeds    = sorted(warm_dir.glob(f"{prefix}*.json")) if warm_dir.exists() else []
    if not seeds:
        # 没有精确匹配，取同赛道任意种子（兼容）
        seeds = sorted(warm_dir.glob(f"{track_id}__*.json"))

    track       = rj(CONFIG_DIR / "tracks" / f"{track_id}.json") \
                  if (CONFIG_DIR / "tracks" / f"{track_id}.json").exists() else {}
    extra_fb    = sa.get("memory", {}).get("extra_forbidden_terms", [])

    # 热点标题映射
    demo_file = CONFIG_DIR / "today-hotspots.demo.json"
    titles    = {}
    if demo_file.exists():
        for h in rj(demo_file):
            if h.get("title"):
                titles[h["hotspot_id"]] = h["title"]

    outputs, meta = [], {}
    for seed in seeds:
        o = gate_visible(rj(seed), track, extra_fb)
        hid = o.get("hotspot_id", "")
        meta[hid] = build_meta(o, titles.get(hid, ""), track)
        outputs.append(o)

    # AccountProfile（TodayResponse.account 只要 AccountProfile）
    account_profile = {
        "account_id":     sa["account_id"],
        "tenant_id":      sa["tenant_id"],
        "display_name":   sa["display_name"],
        "track_id":       sa["track_id"],
        "platform_id":    sa["platform_id"],
        "positioning_id": sa["positioning_id"],
    }

    return {
        "account":      account_profile,
        "board":        to_board(outputs),
        "meta":         meta,
        "mode":         "sample",
        "notice":       "当前为示例内容：先感受推荐和成品的样子，运营每天跑批后会替换为最新数据。",
        "date":         today,
        "generated_at": f"{today}T00:00:00Z",
    }

# ── 主流程 ────────────────────────────────────────────────────────────

def main():
    TODAY = "2026-06-10"
    print("📁 建 data/ 目录结构…")
    for d in ["accounts", "hotspots", "runs", "today"]:
        (DATA_DIR / d).mkdir(parents=True, exist_ok=True)
    print("  ✓ data/{accounts,hotspots,runs,today}/")

    # data/runs/README.md
    readme = DATA_DIR / "runs" / "README.md"
    readme.write_text(
        "# data/runs/\n\n"
        "外部 LLM 跑批中间结果归档目录。\n\n"
        "结构：`<date>/<account_id>/`，供排查和历史回溯。\n"
        "不影响线上展示（网站读 `data/today/<account_id>/latest.json`）。\n",
        encoding="utf-8",
    )
    print("  ✓ data/runs/README.md")

    print(f"\n📋 复制热点数据 → data/hotspots/{TODAY}.json …")
    src = CONFIG_DIR / "today-hotspots.demo.json"
    dst = DATA_DIR / "hotspots" / f"{TODAY}.json"
    shutil.copy(src, dst)
    print(f"  ✓ {dst.relative_to(BASE_DIR)}")

    print("\n👤 迁移账号档案 → data/accounts/ …")
    stored_accounts = []
    for p in list_json("account-profiles"):
        sa = build_stored_account(p)
        wj(DATA_DIR / "accounts" / f"{sa['account_id']}.json", sa)
        stored_accounts.append(sa)
    print(f"  共 {len(stored_accounts)} 个账号")

    print(f"\n📅 装配今日推荐 → data/today/<id>/{TODAY}.json + latest.json …")
    for sa in stored_accounts:
        resp  = build_today_response(sa, TODAY)
        dated  = DATA_DIR / "today" / sa["account_id"] / f"{TODAY}.json"
        latest = DATA_DIR / "today" / sa["account_id"] / "latest.json"
        wj(dated, resp)
        shutil.copy(dated, latest)
        picks   = len(resp["board"]["picks"])
        skipped = len(resp["board"]["skipped"])
        print(f"    {sa['account_id']}: picks={picks} skipped={skipped}  → latest.json")

    print("\n✅ 迁移完成。")
    print(f"   data/accounts/ : {len(stored_accounts)} 个账号 JSON")
    print(f"   data/hotspots/ : {TODAY}.json")
    print(f"   data/today/    : {len(stored_accounts)} 个账号 × 2 份（dated + latest）")
    print("   data/runs/     : README.md（目录占位）")


if __name__ == "__main__":
    main()
