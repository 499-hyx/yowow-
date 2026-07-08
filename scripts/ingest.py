#!/usr/bin/env python3
"""
scripts/ingest.py · 收外部 LLM 回贴并安装成网站可读 TodayResponse。

用法:
  python3 scripts/ingest.py <account_id> <回贴文件或目录> [--date YYYY-MM-DD]
  python3 scripts/ingest.py <account_id> <回贴文件或目录> --feedback feedback.json
  python3 scripts/ingest.py --selftest

设计边界：
  - 只做机械校验、id 注入、档位封顶、用词硬门、文件安装。
  - 不改提示词、不发明桥梁、不调用 LLM。
  - 失败时非零退出，且不写 data/today 半成品。
"""
import argparse
import datetime as _dt
import importlib.util
import json
import os
import re
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(PROJECT_ROOT)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
CONFIG_DIR = os.path.join(PROJECT_ROOT, "config")

_LOADER_DIR = os.path.join(REPO_ROOT, "skills", "adaptation-engine")
sys.path.insert(0, _LOADER_DIR)
import prompt_loader as _pl

_MAKE_PROMPT = os.path.join(HERE, "make-prompt.py")
_SPEC = importlib.util.spec_from_file_location("make_prompt", _MAKE_PROMPT)
_mp = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_mp)
sys.path.insert(0, HERE)
import mvp_policy

INTERNAL_OR_SCORE = list(_mp.INTERNAL_OR_SCORE)


def _load_forced_hints():
    # 单一来源 = config/global-gate.json（forced_connection_hints）。读不到则回退内置清单。
    fallback = ["硬蹭", "硬扯", "强蹭", "强行", "绕很远", "情绪硬蹭", "生蹭"]
    try:
        with open(os.path.join(CONFIG_DIR, "global-gate.json"), "r", encoding="utf-8") as f:
            hints = (json.load(f) or {}).get("forced_connection_hints")
        return list(hints) if hints else fallback
    except Exception:
        return fallback


FORCED_CONNECTION_HINTS = _load_forced_hints()
FIVE = [
    "phenomenon",
    "real_problem",
    "track_relation",
    "product_value_support",
    "platform_expression",
]
ADAPTATION_KEYS = {
    "hotspot_id",
    "track_id",
    "platform_id",
    "positioning_id",
    "relevance_score",
    "naturalness_score",
    "recommendation",
    "forced_flag",
    "skip_reason",
    "bridge_paths",
    "chosen_path_id",
    "content",
    "external_terms_check",
    "risk_note",   # 给老板的发布前提醒（如「争议大，交博士收口」），前端按视角展示
}


def safe_relpath(path, start):
    try:
        return os.path.relpath(path, start)
    except ValueError:
        return os.path.abspath(path)
REC_ORDER = {"skip": 0, "maybe": 1, "strong_pick": 2}


class IngestError(Exception):
    pass


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", suffix=".json", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise


def json_copy(obj):
    return json.loads(json.dumps(obj, ensure_ascii=False))


def today_str():
    return str(_dt.date.today())


def load_account(account_id):
    return _mp.load_account(account_id)


def load_hotspots(date_str, track_id=None):
    # 两池合并：公共池 + 赛道池（与 make-prompt 同源）
    return _mp.load_hotspots(date_str, track_id)


def load_track(account):
    return _mp.load_config("tracks", account["track_id"], "赛道")


def effective_track(account):
    return _mp.build_effective_track(load_track(account), account.get("memory") or {})


def scan_internal(text):
    low = text.lower()
    out = []
    for word in INTERNAL_OR_SCORE:
        if not word:
            continue
        if all(ord(c) < 128 for c in word):
            if word.lower() in low:
                out.append(word)
        elif word in text:
            out.append(word)
    return out


def scan_terms(text, terms):
    return [w for w in terms if w and w in text]


def visible_strings(output):
    out = []
    for path in output.get("bridge_paths") or []:
        for key in FIVE:
            if path.get(key):
                out.append(str(path[key]))
    content = output.get("content")
    if isinstance(content, dict):
        for key in ("topic", "title", "body_or_script"):
            if content.get(key):
                out.append(str(content[key]))
    if output.get("skip_reason"):
        out.append(str(output["skip_reason"]))
    return out


def forbidden_terms_for(account):
    bridge = (effective_track(account).get("bridge") or {})
    return list(bridge.get("forbidden_terms") or [])


def gate_visible(output, account, *, strict=False):
    terms = forbidden_terms_for(account)
    for field_value in visible_strings(output):
        internal = scan_internal(field_value)
        forbidden = scan_terms(field_value, terms)
        forced = scan_terms(field_value, FORCED_CONNECTION_HINTS)
        if internal or forbidden or forced:
            if internal or forbidden:
                words = internal + forbidden
                msg = f"用词硬门命中：{words}；字段内容片段：{field_value[:80]}"
                reason = f"这条成品没过用词自检，先不给你看。命中：{'、'.join(words)}"
            else:
                msg = f"连接硬蹭硬门命中：{forced}；字段内容片段：{field_value[:80]}"
                reason = f"这条连接像情绪硬蹭，先跳过。命中：{'、'.join(forced)}"
            if strict:
                raise IngestError(msg)
            return {
                **output,
                "recommendation": "skip",
                "forced_flag": True,
                "skip_reason": reason,
                "bridge_paths": [],
                "chosen_path_id": None,
                "content": None,
                "external_terms_check": False,
            }, msg
    return output, None


def extract_response(path):
    text = open(path, "r", encoding="utf-8").read()
    try:
        return _pl.extract_json(text)
    except Exception as e:
        raise IngestError(f"{path}: JSON 抽取失败：{e}")


def response_files(input_path):
    if os.path.isdir(input_path):
        files = []
        for name in sorted(os.listdir(input_path)):
            if name.startswith("."):
                continue
            p = os.path.join(input_path, name)
            if os.path.isfile(p) and name.lower().endswith((".json", ".txt", ".md")):
                files.append(p)
        if not files:
            raise IngestError(f"目录里没有可读取的回贴文件：{input_path}")
        return files
    if os.path.isfile(input_path):
        return [input_path]
    raise IngestError(f"回贴文件或目录不存在：{input_path}")


def detect_kind(data, path):
    if isinstance(data, dict) and "tier" in data:
        return "match"
    if isinstance(data, dict) and "recommendation" in data and "bridge_paths" in data:
        return "generate"
    raise IngestError(f"{path}: 无法判断是 match 还是 generate 回贴（缺 tier 或 recommendation/bridge_paths）")


def hotspot_id_from_path(path):
    name = os.path.splitext(os.path.basename(path))[0]
    for prefix in ("match-", "generate-"):
        if name.startswith(prefix):
            return name[len(prefix):]
    return None


def normalize_match(data, hotspot_id, path):
    tier = data.get("tier")
    if tier not in REC_ORDER:
        raise IngestError(f"{path}: match.tier 非法，应为 strong_pick/maybe/skip，收到 {tier!r}")
    if "skip_reason" not in data:
        raise IngestError(f"{path}: match 结果缺少 skip_reason 字段")
    if tier == "skip" and not data.get("skip_reason"):
        raise IngestError(f"{path}: tier=skip 时 skip_reason 不能为空")
    if not data.get("why_relevant") and tier != "skip":
        raise IngestError(f"{path}: 非 skip match 需要 why_relevant")
    if data.get("hotspot_id") and data["hotspot_id"] != hotspot_id:
        raise IngestError(f"{path}: hotspot_id 不一致，文件={hotspot_id}，内容={data['hotspot_id']}")
    return {
        "hotspot_id": hotspot_id,
        "tier": tier,
        "relevance_score": float(data.get("relevance_score") or 0),
        "naturalness_score": float(data.get("naturalness_score") or 0),
        "why_relevant": data.get("why_relevant") or "",
        "skip_reason": data.get("skip_reason"),
    }


def clean_output_keys(output):
    return {k: v for k, v in output.items() if k in ADAPTATION_KEYS}


def inject_and_crosscheck(output, hotspot_id, account, path):
    ids = {
        "hotspot_id": hotspot_id,
        "track_id": account["track_id"],
        "platform_id": account["platform_id"],
        "positioning_id": account["positioning_id"],
    }
    for key, expected in ids.items():
        if output.get(key) not in (None, "", expected):
            raise IngestError(f"{path}: {key} 不一致，应为 {expected}，收到 {output.get(key)}")
        output[key] = expected
    return output


def validate_adaptation_output(output, path):
    rec = output.get("recommendation")
    if rec not in REC_ORDER:
        raise IngestError(f"{path}: recommendation 非法：{rec!r}")
    for key in ("hotspot_id", "track_id", "platform_id", "positioning_id", "relevance_score", "naturalness_score", "bridge_paths"):
        if key not in output:
            raise IngestError(f"{path}: generate 结果缺少必填字段 {key}")
    paths = output.get("bridge_paths")
    if not isinstance(paths, list):
        raise IngestError(f"{path}: bridge_paths 必须是数组")
    if rec == "skip":
        if output.get("content") is not None:
            raise IngestError(f"{path}: skip 必须 content=null")
        if paths:
            raise IngestError(f"{path}: skip 必须 bridge_paths=[]")
    else:
        if len(paths) < 3:
            raise IngestError(f"{path}: non-skip 至少需要 3 条 bridge_paths")
        for i, item in enumerate(paths):
            missing = [k for k in FIVE if not item.get(k)]
            if missing:
                raise IngestError(f"{path}: bridge_paths[{i}] 缺 5 步字段 {missing}")
        chosen = output.get("chosen_path_id")
        if chosen and chosen not in {p.get("path_id") for p in paths}:
            raise IngestError(f"{path}: chosen_path_id 未指向 bridge_paths 内路径：{chosen}")
        content = output.get("content")
        if not isinstance(content, dict):
            raise IngestError(f"{path}: non-skip 必须有 content 对象")
        for key in ("topic", "title", "body_or_script"):
            if not content.get(key):
                raise IngestError(f"{path}: content 缺少 {key}")
    if output.get("external_terms_check") is not True:
        raise IngestError(f"{path}: external_terms_check 必须为 true")
    output["relevance_score"] = float(output.get("relevance_score") or 0)
    output["naturalness_score"] = float(output.get("naturalness_score") or 0)
    return output


def cap_recommendation(output, match):
    if not match:
        return output, None
    match_tier = match["tier"]
    if match_tier == "skip":
        return {
            **output,
            "recommendation": "skip",
            "forced_flag": True,
            "skip_reason": match.get("skip_reason") or "这条跟你的号连不上，硬蹭会伤号，帮你跳过了。",
            "bridge_paths": [],
            "chosen_path_id": None,
            "content": None,
            "external_terms_check": True,
            "relevance_score": match.get("relevance_score", output.get("relevance_score", 0)),
            "naturalness_score": match.get("naturalness_score", output.get("naturalness_score", 0)),
        }, "match=skip，最终降级为 skip"
    if REC_ORDER[output["recommendation"]] > REC_ORDER[match_tier]:
        return {**output, "recommendation": match_tier}, f"生成档位被 match 封顶为 {match_tier}"
    return output, None


def chosen_path(output):
    paths = output.get("bridge_paths") or []
    chosen = output.get("chosen_path_id")
    for item in paths:
        if item.get("path_id") == chosen:
            return item
    return paths[0] if paths else None


def track_vocab(account):
    bridge = (effective_track(account).get("bridge") or {})
    return list(bridge.get("external_vocab") or [])


def build_meta(output, hotspot, account, match=None):
    one_liner = (
        hotspot.get("title")
        or hotspot.get("summary")
        or (chosen_path(output) or {}).get("phenomenon")
        or output["hotspot_id"]
    )
    if output["recommendation"] == "skip":
        reason = output.get("skip_reason") or "这条跟你的号连不上，硬蹭会伤号，帮你跳过了。"
    elif match and match.get("why_relevant"):
        reason = match["why_relevant"]
    elif output["recommendation"] == "maybe":
        reason = f"能接得上，但角度要自己挑，给你 {len(output.get('bridge_paths') or [])} 条讲法参考。"
    else:
        cp = chosen_path(output)
        anchor = "、".join(track_vocab(account)[:2])
        if cp:
            reason = f"这条戳的是「{cp.get('real_problem', '')}」"
            if anchor:
                reason += f"，正好接你的「{anchor}」"
            reason += "，可以直接发。"
        else:
            reason = "今天最适合你的一条，可以直接发。"
    return {"oneLiner": one_liner, "reason": reason}


def to_board(outputs):
    def score(o):
        return (0 if o["recommendation"] == "strong_pick" else 1, -(0.5 * o.get("relevance_score", 0) + 0.5 * o.get("naturalness_score", 0)))

    picks = [strip_scores(o) for o in sorted([o for o in outputs if o["recommendation"] != "skip"], key=score)]
    skipped = [strip_scores(o) for o in outputs if o["recommendation"] == "skip"]
    return {"picks": picks, "also_ran": [], "skipped": skipped}


def strip_scores(output):
    out = dict(output)
    out.pop("relevance_score", None)
    out.pop("naturalness_score", None)
    return out


def account_for_response(account):
    return {
        "account_id": account["account_id"],
        "tenant_id": account["tenant_id"],
        "display_name": account["display_name"],
        "track_id": account["track_id"],
        "platform_id": account["platform_id"],
        "positioning_id": account["positioning_id"],
    }


def parse_responses(input_path, account):
    matches = {}
    generates = {}
    sources = []
    for path in response_files(input_path):
        data = extract_response(path)
        kind = detect_kind(data, path)
        hid = data.get("hotspot_id") or hotspot_id_from_path(path)
        if not hid:
            raise IngestError(f"{path}: 缺少 hotspot_id，且文件名不是 match-<id> / generate-<id>")
        if kind == "match":
            normalized = normalize_match(data, hid, path)
            matches[hid] = normalized
        else:
            output = clean_output_keys(dict(data))
            output = inject_and_crosscheck(output, hid, account, path)
            output = validate_adaptation_output(output, path)
            generates[hid] = output
        sources.append(path)
    return matches, generates, sources


def skip_from_match(match, account):
    return {
        "hotspot_id": match["hotspot_id"],
        "track_id": account["track_id"],
        "platform_id": account["platform_id"],
        "positioning_id": account["positioning_id"],
        "relevance_score": match.get("relevance_score", 0),
        "naturalness_score": match.get("naturalness_score", 0),
        "recommendation": "skip",
        "forced_flag": True,
        "skip_reason": match.get("skip_reason") or "这条跟你的号连不上，硬蹭会伤号，帮你跳过了。",
        "bridge_paths": [],
        "chosen_path_id": None,
        "content": None,
        "external_terms_check": True,
    }


def assemble_today(account_id, input_path, date_str, feedback_path=None):
    account = load_account(account_id)
    _mp.ensure_account_runnable(account)
    track = load_track(account)
    review = mvp_policy.track_review_status(track)
    hotspots = load_hotspots(date_str, account.get("track_id"))
    hotspot_by_id = {h["hotspot_id"]: h for h in hotspots}
    matches, generates, sources = parse_responses(input_path, account)

    outputs = []
    meta = {}
    notes = []
    all_ids = sorted(set(matches) | set(generates))
    if not all_ids:
        raise IngestError("没有可安装的 match/generate 结果")
    for hid in all_ids:
        if hid not in hotspot_by_id:
            raise IngestError(f"{hid}: 回贴里的 hotspot_id 不在 data/hotspots/{date_str}.json 中")
        match = matches.get(hid)
        output = generates.get(hid)
        if match and match["tier"] == "skip":
            output = skip_from_match(match, account)
        elif not output:
            raise IngestError(f"{hid}: match 非 skip 但缺少 generate 回贴")
        else:
            output, cap_note = cap_recommendation(output, match)
            if cap_note:
                notes.append(f"{hid}: {cap_note}")
        output, gate_note = gate_visible(output, account, strict=False)
        if gate_note:
            notes.append(f"{hid}: {gate_note}")
        outputs.append(output)
        meta[hid] = build_meta(output, hotspot_by_id[hid], account, match)

    today = mvp_policy.annotate_today({
        "account": account_for_response(account),
        "board": to_board(outputs),
        "meta": meta,
        "mode": "live",
        "notice": "今日内容已由人工跑批安装；如需修改，请按 RUNBOOK 重新跑批。",
        "date": date_str,
        "generated_at": _dt.datetime.now().isoformat(timespec="seconds"),
    }, track, account)
    manifest = {
        "account_id": account_id,
        "date": date_str,
        "installed_at": _dt.datetime.now().isoformat(timespec="seconds"),
        "model": "（人工填写：外部 LLM 模型名）",
        "source_files": [safe_relpath(p, PROJECT_ROOT) for p in sources],
        "hotspot_tiers": {hid: (matches.get(hid) or {}).get("tier") or generates[hid]["recommendation"] for hid in all_ids},
        "outputs": {
            "picks": [o["hotspot_id"] for o in today["board"]["picks"]],
            "skipped": [o["hotspot_id"] for o in today["board"]["skipped"]],
        },
        "feedback_archived": bool(feedback_path),
        "notes": notes,
        "needs_human_review": review["needs_human_review"],
        "formal_approval": review["formal_approval"],
        "mvp_internal_only": review["mvp_internal_only"],
        "review_status": {
            **review,
            "account_id": account_id,
        },
    }
    return today, manifest, sources


def install(account_id, input_path, date_str, feedback_path=None):
    today, manifest, sources = assemble_today(account_id, input_path, date_str, feedback_path)
    run_dir = os.path.join(DATA_DIR, "runs", date_str, account_id)
    raw_dir = os.path.join(run_dir, "raw")
    today_dir = os.path.join(DATA_DIR, "today", account_id)
    installed_path = os.path.join(run_dir, "installed.json")
    manifest_path = os.path.join(run_dir, "manifest.json")
    run_note_path = os.path.join(run_dir, "RUN-NOTE.md")
    dated_path = os.path.join(today_dir, f"{date_str}.json")
    latest_path = os.path.join(today_dir, "latest.json")

    os.makedirs(raw_dir, exist_ok=True)
    for src in sources:
        shutil.copy2(src, os.path.join(raw_dir, os.path.basename(src)))
    if feedback_path:
        if not os.path.exists(feedback_path):
            raise IngestError(f"feedback 文件不存在：{feedback_path}")
        fb_dir = os.path.join(run_dir, "feedback")
        os.makedirs(fb_dir, exist_ok=True)
        shutil.copy2(feedback_path, os.path.join(fb_dir, os.path.basename(feedback_path)))

    write_json(installed_path, today)
    write_json(manifest_path, manifest)
    if manifest.get("mvp_internal_only"):
        os.makedirs(run_dir, exist_ok=True)
        with open(run_note_path, "w", encoding="utf-8") as f:
            f.write(mvp_policy.run_note_text(account_id, date_str, manifest.get("review_status") or {}))
    atomic_write_json(dated_path, today)
    atomic_write_json(latest_path, today)
    return today, manifest


def valid_fixture(hotspot_id, account):
    return {
        "hotspot_id": hotspot_id,
        "track_id": account["track_id"],
        "platform_id": account["platform_id"],
        "positioning_id": account["positioning_id"],
        "relevance_score": 8.0,
        "naturalness_score": 8.0,
        "recommendation": "strong_pick",
        "forced_flag": False,
        "skip_reason": None,
        "bridge_paths": [
            {
                "path_id": "p1",
                "phenomenon": "大家开始追问产品背后的真实来源。",
                "real_problem": "消费者怕花了钱却买到只会讲故事的东西。",
                "track_relation": "这能自然接到男士日常形象管理里的确定感。",
                "product_value_support": "这条选题能支撑产品把出门前清爽这件事变成稳定动作。",
                "platform_expression": "抖音上用老板口吻先讲判断，再给一个可执行选择。",
            },
            {
                "path_id": "p2",
                "phenomenon": "大牌光环被重新审视。",
                "real_problem": "人们开始把钱花在真实体验而不是标签上。",
                "track_relation": "男士个护同样需要回到每天是否顺手、是否稳定。",
                "product_value_support": "这条路径能说明工具价值不靠名气，而靠每天出门不掉链子。",
                "platform_expression": "用对比式口播开头，把选择标准讲清楚。",
            },
            {
                "path_id": "p3",
                "phenomenon": "用户愿意学习更细的判断标准。",
                "real_problem": "怕踩雷的人需要一套简单可执行的选择方法。",
                "track_relation": "剃须刀选择也可以从体面、效率、稳定三个维度判断。",
                "product_value_support": "这条路径能把产品价值落到省时间和少拉扯的体验上。",
                "platform_expression": "用三点清单做短视频结构，方便收藏和转发。",
            },
        ],
        "chosen_path_id": "p1",
        "content": {
            "topic": "大牌光环退了以后，男士个护该看什么",
            "title": "买男士个护，别只看牌子",
            "body_or_script": "品牌当然重要，但每天出门前真正救你的，是顺手、稳定、不耽误事。选剃须刀也一样，别只看名气，要看它能不能让你几十秒把脸收拾干净。"
        },
        "external_terms_check": True,
    }


def selftest():
    print("─── ingest.py --selftest ───")
    account_id = "acct-razor-douyin-boss"
    date_str = "2026-06-10"
    account = load_account(account_id)
    hotspot_id = "hs-demo-nike-20260606"
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw")
        os.makedirs(raw)
        match = {
            "hotspot_id": hotspot_id,
            "tier": "maybe",
            "relevance_score": 7.5,
            "naturalness_score": 7.0,
            "why_relevant": "这条讨论的是消费者重新看真实价值，能接到你强调的日常效率与体面感。",
            "skip_reason": None,
        }
        write_json(os.path.join(raw, f"match-{hotspot_id}.json"), match)
        write_json(os.path.join(raw, f"generate-{hotspot_id}.json"), valid_fixture(hotspot_id, account))
        today, manifest, _ = assemble_today(account_id, raw, date_str)
        assert today["board"]["picks"][0]["recommendation"] == "maybe", "档位封顶未生效"
        assert today["meta"][hotspot_id]["reason"] == match["why_relevant"], "meta 未优先用 match why_relevant"
        assert manifest["hotspot_tiers"][hotspot_id] == "maybe"
        print("✅ 合法 match+generate 可装配，且 strong_pick 被 maybe 封顶")

        bad_missing = os.path.join(tmp, "bad-missing")
        os.makedirs(bad_missing)
        bad = json_copy(valid_fixture(hotspot_id, account))
        bad["bridge_paths"][0].pop("real_problem")
        write_json(os.path.join(bad_missing, f"generate-{hotspot_id}.json"), bad)
        try:
            assemble_today(account_id, bad_missing, date_str)
            raise AssertionError("缺字段应被拒收")
        except IngestError as e:
            assert "缺 5 步字段" in str(e)
            print("✅ 缺 bridge 5 步字段会拒收")

        bad_id = os.path.join(tmp, "bad-id")
        os.makedirs(bad_id)
        wrong = json_copy(valid_fixture(hotspot_id, account))
        wrong["track_id"] = "wrong-track"
        write_json(os.path.join(bad_id, f"generate-{hotspot_id}.json"), wrong)
        try:
            assemble_today(account_id, bad_id, date_str)
            raise AssertionError("id 不一致应被拒收")
        except IngestError as e:
            assert "track_id 不一致" in str(e)
            print("✅ id 不一致会拒收")

        bad_term = os.path.join(tmp, "bad-term")
        os.makedirs(bad_term)
        term = json_copy(valid_fixture(hotspot_id, account))
        term["content"]["title"] = "这不是智商税"
        write_json(os.path.join(bad_term, f"generate-{hotspot_id}.json"), term)
        today, _, _ = assemble_today(account_id, bad_term, date_str)
        assert today["board"]["skipped"][0]["hotspot_id"] == hotspot_id
        assert today["board"]["skipped"][0]["external_terms_check"] is False
        print("✅ 成品禁词命中会降级 skip，不进入 picks")

        bad_forced = os.path.join(tmp, "bad-forced")
        os.makedirs(bad_forced)
        forced_out = json_copy(valid_fixture(hotspot_id, account))
        forced_out["bridge_paths"][0]["track_relation"] = "这条得硬蹭才接得上。"
        write_json(os.path.join(bad_forced, f"generate-{hotspot_id}.json"), forced_out)
        today, _, _ = assemble_today(account_id, bad_forced, date_str)
        assert today["board"]["skipped"][0]["hotspot_id"] == hotspot_id
        assert today["board"]["skipped"][0]["external_terms_check"] is False
        print("✅ 成品连接硬蹭（forced-hints）命中会降级 skip")

        feedback = os.path.join(tmp, "feedback.json")
        write_json(feedback, {"feedback_submitted_ids": [hotspot_id]})
        today, manifest, _ = assemble_today(account_id, raw, date_str, feedback)
        assert manifest["feedback_archived"] is True
        print("✅ --feedback 会进入 manifest 标记")

        legacy_status_path = os.path.join(DATA_DIR, "accounts", "acct-selftest-legacy-status-ingest.json")
        try:
            legacy_account = json_copy(account)
            legacy_account["account_id"] = "acct-selftest-legacy-status-ingest"
            legacy_account["display_name"] = "Selftest legacy-status ingest account"
            legacy_account["status"] = "inactive"
            write_json(legacy_status_path, legacy_account)
            today, manifest, _ = assemble_today("acct-selftest-legacy-status-ingest", raw, date_str)
            assert today["account"]["account_id"] == "acct-selftest-legacy-status-ingest"
            assert "status" not in today["account"]
            assert "account_status" not in manifest["review_status"]
            print("✅ 账号 status 字段会被 ingest 忽略")
        finally:
            try:
                os.remove(legacy_status_path)
            except FileNotFoundError:
                pass

    print("\n🎉 ingest.py --selftest 全过")
    return 0


def main():
    ap = argparse.ArgumentParser(description="收外部 LLM 回贴并安装成 TodayResponse")
    ap.add_argument("account_id", nargs="?")
    ap.add_argument("input_path", nargs="?")
    ap.add_argument("--date", default=today_str(), metavar="YYYY-MM-DD")
    ap.add_argument("--feedback", help="今日推荐页导出的反馈 JSON，可选；本阶段只归档不回流")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        sys.exit(selftest())
    if not args.account_id or not args.input_path:
        ap.print_help()
        sys.exit(1)
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", args.date):
        print(f"❌ 日期格式应为 YYYY-MM-DD，收到：{args.date}", file=sys.stderr)
        sys.exit(1)
    try:
        today, manifest = install(args.account_id, args.input_path, args.date, args.feedback)
    except (IngestError, FileNotFoundError, ValueError, json.JSONDecodeError) as e:
        print(f"❌ ingest 失败：{e}", file=sys.stderr)
        sys.exit(1)
    print("✅ ingest 完成")
    print(f"   账号: {args.account_id}  日期: {args.date}")
    print(f"   picks: {len(today['board']['picks'])}  skipped: {len(today['board']['skipped'])}")
    print(f"   已写入: data/today/{args.account_id}/{args.date}.json")
    print(f"   已更新: data/today/{args.account_id}/latest.json")
    print(f"   run 记录: data/runs/{args.date}/{args.account_id}/")
    if manifest.get("notes"):
        print("   注意:")
        for note in manifest["notes"]:
            print(f"   - {note}")


if __name__ == "__main__":
    main()
