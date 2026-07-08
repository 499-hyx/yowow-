#!/usr/bin/env python3
"""Generate today's hotspot pools from the same prompt files shown in /ops.

This is the automated equivalent of:
  /ops -> 刷新热点提示词 -> copy public/track prompts -> ask LLM -> 保存热点池

It does not invent a second prompt system. It reads prompts/公共热点 and
prompts/赛道热点, calls the configured LLM, normalizes JSON arrays, and writes:
  data/hotspots/<date>.json
  data/hotspots/tracks/<track_id>/<date>.json
"""
import argparse
import datetime as dt
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(BASE, "data")
PROMPTS_DIR = os.path.join(BASE, "prompts")
CONFIG_DIR = os.path.join(BASE, "config")
sys.path.insert(0, SCRIPT_DIR)

import cron_llm_email

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[a-z0-9-]+$")


def read_text(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(value, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def replace_vars(text, replacements):
    out = text
    for key, value in replacements.items():
        out = out.replace("{" + key + "}", value or "")
    return out


def ensure_date(date_str):
    if not DATE_RE.match(date_str):
        raise SystemExit(f"date must be YYYY-MM-DD, got: {date_str}")
    return date_str


def ensure_id(value, label):
    if not value or not ID_RE.match(value):
        raise SystemExit(f"{label} is invalid: {value}")
    return value


def parse_front_matter(text):
    normalized = text.lstrip("\ufeff")
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?", normalized)
    if not match:
        return {}, text
    metadata = {}
    for line in match.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        metadata[key.strip()] = value
    return metadata, normalized[match.end():]


def registered_broad_prompts(date_str):
    source_dir = os.path.join(PROMPTS_DIR, "公共热点", "来源注册")
    prompts = []
    if os.path.isdir(source_dir):
        for name in sorted(os.listdir(source_dir)):
            lower = name.lower()
            if not name.endswith(".md") or lower == "readme.md" or name == "说明.md" or name.startswith("_"):
                continue
            raw = read_text(os.path.join(source_dir, name))
            metadata, body = parse_front_matter(raw)
            if metadata.get("enabled", "true").lower() == "false":
                continue
            prompt_id = metadata.get("id") or os.path.splitext(name)[0]
            title = metadata.get("title") or prompt_id
            source_file = metadata.get("source_file", "").strip()
            if source_file:
                source_path = os.path.abspath(os.path.join(source_dir, source_file))
                prompts_root = os.path.abspath(PROMPTS_DIR)
                if not source_path.startswith(prompts_root + os.sep):
                    raise SystemExit(f"prompt source_file escapes prompts/: {name}")
                body = read_text(source_path)
            prompts.append({
                "id": prompt_id,
                "title": title,
                "text": replace_vars(body.strip(), {"date": date_str}),
            })

    if prompts:
        return prompts

    fallback = [
        ("platform-native", "平台原生全网热点", os.path.join(PROMPTS_DIR, "公共热点", "平台原生全网热点.md")),
        ("ultimate-radar", "终极雷达热点", os.path.join(PROMPTS_DIR, "公共热点", "终极雷达热点.md")),
    ]
    for prompt_id, title, path in fallback:
        if os.path.exists(path):
            prompts.append({"id": prompt_id, "title": title, "text": replace_vars(read_text(path), {"date": date_str})})
    return prompts


def account_and_track(account_id):
    account_id = ensure_id(account_id, "account_id")
    account = read_json(os.path.join(DATA_DIR, "accounts", f"{account_id}.json"))
    track_id = ensure_id(account.get("track_id"), "track_id")
    track = read_json(os.path.join(CONFIG_DIR, "tracks", f"{track_id}.json"))
    return account, track


def track_prompt(track_id, track, date_str):
    specific = os.path.join(PROMPTS_DIR, "赛道热点", track_id, "热点搜索.md")
    fallback = os.path.join(PROMPTS_DIR, "赛道热点", "通用赛道热点搜索.md")
    template = read_text(specific if os.path.exists(specific) else fallback)
    bridge = track.get("bridge") or {}
    directions = bridge.get("search_directions") or []
    return {
        "id": f"track-{track_id}",
        "title": f"赛道热点：{track.get('track_name') or track_id}",
        "text": replace_vars(template, {
            "date": date_str,
            "track": track.get("track_name") or track_id,
            "search_brief": bridge.get("search_brief") or track.get("daily_search_question") or "",
            "directions": "\n".join(f"{idx + 1}. {item}" for idx, item in enumerate(directions)),
        }),
    }


def parse_json_values(text):
    values = []
    start = -1
    depth = 0
    quote = ""
    escaped = False
    for index, char in enumerate(text):
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = ""
            continue
        if char in ('"', "'"):
            if depth > 0:
                quote = char
            continue
        if char in "[{":
            if depth == 0:
                start = index
            depth += 1
            continue
        if char in "]}":
            if depth == 0:
                continue
            depth -= 1
            if depth == 0 and start >= 0:
                values.append(json.loads(text[start:index + 1]))
                start = -1
    if not values:
        raise ValueError("LLM response did not contain JSON")
    return values


def collect_records(value):
    if isinstance(value, list):
        out = []
        for item in value:
            out.extend(collect_records(item))
        return out
    if isinstance(value, dict):
        for key in ("hotspots", "items", "results", "data"):
            nested = value.get(key)
            if isinstance(nested, list):
                return collect_records(nested)
        return [value]
    return []


def flatten_records(text):
    records = []
    for value in parse_json_values(text):
        records.extend(collect_records(value))
    if not all(isinstance(item, dict) for item in records):
        raise ValueError("hotspot response must contain JSON objects or arrays")
    return records


def compact_date(date_str):
    return date_str.replace("-", "")


def string_list(value):
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str) and item.strip()] or None
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return None


def normalize_hotspot(item, index, *, date_str, kind, track_id=None, source_prompt_id="llm"):
    title = item.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("every hotspot must contain title")
    direction = "broad" if kind == "broad" else track_id
    fallback_id = f"hs-{compact_date(date_str)}-{direction}-{index + 1:03d}"
    hotspot_id = item.get("hotspot_id") or item.get("id") or fallback_id
    if not isinstance(hotspot_id, str) or not hotspot_id.strip():
        hotspot_id = fallback_id
    item = dict(item)
    item["id"] = item.get("id") or hotspot_id
    item["hotspot_id"] = hotspot_id
    item["date"] = item.get("date") or date_str
    item["source_skill"] = item.get("source_skill") or "external-llm-hotspot-search"
    item["source_direction"] = item.get("source_direction") or source_prompt_id
    item["scope"] = item.get("scope") or ("broad" if kind == "broad" else f"track:{track_id}")
    if not item.get("conflict_point") and item.get("conflict_hint"):
        item["conflict_point"] = item.get("conflict_hint")
    if not item.get("candidate_problem_dimensions"):
        item["candidate_problem_dimensions"] = string_list(item.get("problem_dimensions_hint")) or []
    if "heat_score_10" not in item and isinstance(item.get("est_heat_score_10"), (int, float)):
        item["heat_score_10"] = item["est_heat_score_10"]
    return item


def dedupe(records):
    seen = set()
    out = []
    for item in records:
        key = (str(item.get("title", "")).strip(), str(item.get("source_url", "")).strip())
        fallback = item.get("hotspot_id")
        marker = key if key[0] else fallback
        if marker in seen:
            continue
        seen.add(marker)
        out.append(item)
    return out


def ask_prompt(prompt, *, dry_run=False):
    print(f"calling LLM for hotspot prompt: {prompt['title']}", flush=True)
    if dry_run:
        return []
    raw = cron_llm_email.call_llm(
        "你是热点池采集器。只输出提示词要求的 JSON，不要 Markdown，不要解释。",
        prompt["text"],
    )
    return flatten_records(raw)


def generate_pools(account_id, date_str, *, dry_run=False):
    date_str = ensure_date(date_str)
    account, track = account_and_track(account_id)
    track_id = ensure_id(account.get("track_id"), "track_id")

    broad_records = []
    for prompt in registered_broad_prompts(date_str):
        records = ask_prompt(prompt, dry_run=dry_run)
        offset = len(broad_records)
        broad_records.extend(
            normalize_hotspot(item, offset + idx, date_str=date_str, kind="broad", source_prompt_id=prompt["id"])
            for idx, item in enumerate(records)
        )

    track_records = []
    prompt = track_prompt(track_id, track, date_str)
    records = ask_prompt(prompt, dry_run=dry_run)
    track_records.extend(
        normalize_hotspot(item, idx, date_str=date_str, kind="track", track_id=track_id, source_prompt_id=track_id)
        for idx, item in enumerate(records)
    )

    broad_records = dedupe(broad_records)
    track_records = dedupe(track_records)
    if dry_run:
        print(f"dry-run: would write broad={len(broad_records)} track={len(track_records)}")
        return {"broad": len(broad_records), "track": len(track_records), "track_id": track_id}

    broad_path = os.path.join(DATA_DIR, "hotspots", f"{date_str}.json")
    track_path = os.path.join(DATA_DIR, "hotspots", "tracks", track_id, f"{date_str}.json")
    write_json(broad_path, broad_records)
    write_json(track_path, track_records)
    print(f"wrote {len(broad_records)} broad hotspots -> {os.path.relpath(broad_path, BASE)}")
    print(f"wrote {len(track_records)} track hotspots -> {os.path.relpath(track_path, BASE)}")
    return {"broad": len(broad_records), "track": len(track_records), "track_id": track_id}


def selftest():
    prompts = registered_broad_prompts("2099-01-01")
    assert prompts, "expected public hotspot prompts"
    account, track = account_and_track("acct-xiaozhu-edu-xhs")
    assert account["track_id"] == "education-yowow"
    assert "2099-01-01" in track_prompt("education-yowow", track, "2099-01-01")["text"]
    records = flatten_records('prefix [{"title":"A"}] suffix {"title":"B"}')
    assert len(records) == 2
    normalized = normalize_hotspot({"title": "A"}, 0, date_str="2099-01-01", kind="track", track_id="education-yowow")
    assert normalized["hotspot_id"] == "hs-20990101-education-yowow-001"
    print("generate_hotspot_pool.py --selftest passed")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Generate hotspot pools with the /ops hotspot prompts and configured LLM.")
    parser.add_argument("account_id", nargs="?")
    parser.add_argument("--date", default=str(dt.date.today()))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        sys.exit(selftest())
    if not args.account_id:
        parser.print_help()
        sys.exit(1)
    generate_pools(args.account_id, args.date, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
