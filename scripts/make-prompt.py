#!/usr/bin/env python3
"""
scripts/make-prompt.py · 拼 prompt，供人工粘给外部 LLM

用法:
  python3 scripts/make-prompt.py <account_id> [--date YYYY-MM-DD] [--step match|generate|all]
  python3 scripts/make-prompt.py --selftest

<account_id> 对应 data/accounts/<id>.json。
<date> 默认今天（YYYY-MM-DD）。
--step: match=只出筛选 prompt；generate=只出内容生成 prompt；all（默认）=两步都出。

输出到 data/runs/<date>/<account_id>/prompts/*.txt，同时打印到终端可直接整段粘给外部 LLM。

占位符替换走白名单（与 skills/adaptation-engine/prompt_loader.py 的 KNOWN_PLACEHOLDERS 同源），
示例 JSON 里的花括号不动。
"""
import json, os, re, sys, argparse, shutil, tempfile
from datetime import date as _date_cls

# ── 路径 ──────────────────────────────────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(HERE)          # yowow-adaptation/
REPO_ROOT    = os.path.dirname(PROJECT_ROOT)  # 博士热点评价-多赛道改造/

# 复用 prompt_loader 的白名单 + 模板渲染工具（不重复实现）
_LOADER_DIR = os.path.join(REPO_ROOT, "skills", "adaptation-engine")
sys.path.insert(0, _LOADER_DIR)
import prompt_loader as _pl   # KNOWN_PLACEHOLDERS, extract_json, strip_comments, find_placeholders, _coerce
sys.path.insert(0, HERE)
import mvp_policy

# 本项目自己的 prompts 目录（不用 adaptation-core/prompts/）
PROMPTS_DIR  = os.path.join(PROJECT_ROOT, "prompts")
CONFIG_DIR   = os.path.join(PROJECT_ROOT, "config")
DATA_DIR     = os.path.join(PROJECT_ROOT, "data")

PROMPT_TEMPLATE_FILES = {
    "hotspot-match": os.path.join("分析提示词", "热点匹配判断.md"),
    "content-generate": os.path.join("分析提示词", "内容生成.md"),
}

# ── 常量：内部术语清单 ──────────────────────────────────────────────────
# 单一来源 = config/global-gate.json（internal_or_score）。Python 活路径（make-prompt + ingest
# 复用本变量）从这里读；TS 侧（skip-gate/adaptation-types/display-text）由
# test/global-gate-parity.test.mjs 守住与本文件一致。读不到文件则回退到内置清单（行为不变）。
_INTERNAL_OR_SCORE_FALLBACK = [
    "远迁移", "far transfer", "OOD", "in-distribution", "范式转移",
    "relevance", "naturalness", "相关度分", "自然度分",
]


def _load_internal_or_score():
    try:
        with open(os.path.join(CONFIG_DIR, "global-gate.json"), "r", encoding="utf-8") as f:
            terms = (json.load(f) or {}).get("internal_or_score")
        return list(terms) if terms else list(_INTERNAL_OR_SCORE_FALLBACK)
    except Exception:
        return list(_INTERNAL_OR_SCORE_FALLBACK)


INTERNAL_OR_SCORE = _load_internal_or_score()

# ── 工具函数 ──────────────────────────────────────────────────────────────────

def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def load_template(name):
    """从 yowow-adaptation/prompts/ 加载模板（区别于 adaptation-core/prompts/）。"""
    relative_path = PROMPT_TEMPLATE_FILES.get(name, f"{name}.md")
    p = os.path.join(PROMPTS_DIR, relative_path)
    if not os.path.exists(p):
        raise FileNotFoundError(f"提示词模板不存在: {p}")
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def render_template(name, variables):
    """
    渲染模板。只替换白名单内的占位符（与 prompt_loader.KNOWN_PLACEHOLDERS 同源）。
    模板示例 JSON 的花括号原样保留，绝不被误伤。
    """
    raw   = load_template(name)
    text  = _pl.strip_comments(raw)
    used  = _pl.find_placeholders(text)
    for ph in used:
        if ph in variables:
            text = text.replace("{" + ph + "}", _pl._coerce(variables[ph]))
    return text


# ── buildEffectiveTrack：当前 Python 跑批侧的有效赛道装配逻辑 ──────────────────

# B档迁移（2026-06-11）：搜索方向已并入 tracks/<id>.json 的 bridge.search_directions，
# 赛道文件是方法论唯一事实源；config/bridge-directions/ 已废弃（旧文件在 config/deprecated/）。

APPROVED_STATUSES = {"approved", "reference"}  # reference = 教育参照赛道，视同定稿


def ensure_account_runnable(account):
    """账号只要存在 account_id 且配置完整，就不再需要 status 开关。"""
    if not mvp_policy.account_can_run(account):
        raise SystemExit(
            f"⛔ {mvp_policy.account_block_message(account)}\n"
            "   走法：补齐账号 JSON 的 account_id / track_id / platform_id / positioning_id。"
        )


ensure_account_active = ensure_account_runnable


def ensure_track_approved(track_json):
    """Non-approved tracks may run only as single-admin internal MVP output."""
    warning = mvp_policy.track_warning(track_json)
    if warning:
        print(warning, file=sys.stderr)
    return mvp_policy.track_review_flags(track_json)


def build_effective_track(track_json, memory):
    """
    将账号记忆叠加到赛道基础配置。
    合并规则（B档定版，单向）：
      - **方法论永远取自赛道文件**：internal_lens / search_directions / example_bridges
        只来自 tracks/<id>.json，账号记忆无权覆盖（杜绝定稿被旧副本盖掉）。
      - **业务事实取自账号**：product_value / proof_assets / anxiety_anchors 等非空覆盖。
      - **账号的 extra_* 只能追加**：forbidden_terms / external_vocab 取并集，只增不减。
    """
    if not track_json:
        return None
    if not memory:
        return track_json

    base   = dict(track_json)
    bridge = dict(base.get("bridge") or {})

    dirs = bridge.get("search_directions") or []

    result = {
        **base,
        "audience":        memory.get("audience")        or base.get("audience"),
        "product_value":   memory.get("product_value")   or base.get("product_value"),
        "anxiety_anchors": memory["anxiety_anchors"] if memory.get("anxiety_anchors") else base.get("anxiety_anchors"),
        "proof_assets":    memory["proof_assets"]    if memory.get("proof_assets")    else base.get("proof_assets"),
        "commercial_goal": memory["commercial_goal"] if memory.get("commercial_goal") else base.get("commercial_goal"),
        "banned_topics":   memory.get("banned_topics") or [],
        "bridge": {
            **bridge,
            "external_vocab":   list(bridge.get("external_vocab")   or []) + list(memory.get("extra_external_vocab")   or []),
            "forbidden_terms":  list(bridge.get("forbidden_terms")  or []) + list(memory.get("extra_forbidden_terms")  or []),
            **({"search_directions": dirs} if dirs else {}),
        },
    }
    if memory.get("content_style"):
        result["content_style"] = memory["content_style"]
    else:
        result.pop("content_style", None)
    return result


def _as_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _contains_any(text, terms):
    lower = str(text).lower()
    return any(str(term).strip() and str(term).lower() in lower for term in terms)


def _safe_text(value, blocked_terms):
    text = str(value or "").strip()
    return "" if text and _contains_any(text, blocked_terms) else text


def _safe_list(value, blocked_terms, limit=5):
    out = []
    for item in _as_list(value):
        if _contains_any(item, blocked_terms):
            continue
        out.append(item)
        if len(out) >= limit:
            break
    return out


def _append_line(lines, label, value):
    if value:
        lines.append(f"- {label}：{value}")


def _append_list(lines, label, values):
    if values:
        lines.append(f"- {label}：" + "；".join(values))


def build_account_match_card(account, effective_track, platform_json, positioning_json):
    """给外部 LLM 的短判断卡：只放可读业务信息，不暴露整份 track JSON。"""
    bridge = effective_track.get("bridge") or {}
    blocked_terms = list(INTERNAL_OR_SCORE) + _as_list(bridge.get("forbidden_terms"))
    track_memory = effective_track.get("track_memory") or {}
    buyer = effective_track.get("buyer") or {}
    memory = account.get("memory") or {}

    lines = []
    _append_line(lines, "账号", _safe_text(account.get("display_name") or account.get("account_id"), blocked_terms))
    _append_line(lines, "赛道", _safe_text(effective_track.get("track_name") or effective_track.get("track_id"), blocked_terms))
    _append_line(lines, "平台", _safe_text(platform_json.get("platform_name") or account.get("platform_id"), blocked_terms))
    _append_line(lines, "人设", _safe_text(positioning_json.get("positioning_name") or account.get("positioning_id"), blocked_terms))
    _append_line(lines, "业务", _safe_text(memory.get("business") or buyer.get("business"), blocked_terms))
    _append_line(lines, "受众", _safe_text(effective_track.get("audience"), blocked_terms))
    _append_line(lines, "账号卖点", _safe_text(effective_track.get("product_value"), blocked_terms))
    _append_list(lines, "客户焦虑", _safe_list(effective_track.get("anxiety_anchors"), blocked_terms, limit=6))
    _append_list(lines, "适合的热点", _safe_list(track_memory.get("good_hotspot_signals"), blocked_terms, limit=5))
    _append_list(lines, "不适合的热点", _safe_list(track_memory.get("avoid"), blocked_terms, limit=5))
    _append_list(lines, "禁区", _safe_list(effective_track.get("banned_topics"), blocked_terms, limit=5))
    _append_list(lines, "可用证据", _safe_list(effective_track.get("proof_assets"), blocked_terms, limit=4))
    _append_line(lines, "表达风格", _safe_text(effective_track.get("content_style"), blocked_terms))

    if not lines:
        return "- 账号判断卡暂缺，请先补账号 memory。"
    return "\n".join(lines)


def build_platform_rules(platform_json):
    """给生成提示词的短平台卡：只保留影响成品形态的规则。"""
    if not platform_json:
        return "- 平台规则暂缺，请按账号平台的常规内容形态输出。"
    hook = platform_json.get("hook") or {}
    lines = []
    _append_line(lines, "内容形态", platform_json.get("content_form"))
    _append_line(lines, "分发逻辑", platform_json.get("distribution_logic"))
    _append_line(lines, "开头/封面原则", hook.get("principle") or hook.get("window"))
    _append_line(lines, "标题逻辑", platform_json.get("title_logic"))
    _append_line(lines, "长度规范", platform_json.get("length_norm"))
    _append_list(lines, "平台奖励", _as_list(platform_json.get("rewards"))[:5])
    _append_list(lines, "平台惩罚", _as_list(platform_json.get("penalizes"))[:5])
    _append_line(lines, "转化路径", platform_json.get("conversion_path"))
    _append_list(lines, "表达规则", _as_list(platform_json.get("expression_rules"))[:6])
    return "\n".join(lines) if lines else "- 平台规则暂缺，请按账号平台的常规内容形态输出。"


# ── 主逻辑 ────────────────────────────────────────────────────────────────────

def load_account(account_id):
    p = os.path.join(DATA_DIR, "accounts", f"{account_id}.json")
    if not os.path.exists(p):
        raise FileNotFoundError(
            f"账号文件不存在: {p}\n"
            f"已有账号：{[f[:-5] for f in os.listdir(os.path.join(DATA_DIR, 'accounts')) if f.endswith('.json')]}"
        )
    return read_json(p)


def _read_hotspot_file(p):
    """读单个热点池文件并做基本校验，返回列表。"""
    hotspots = read_json(p)
    if not isinstance(hotspots, list):
        raise ValueError(f"热点文件应为 JSON 数组: {p}")
    for i, h in enumerate(hotspots):
        if not h.get("hotspot_id"):
            raise ValueError(f"热点 #{i} 缺少 hotspot_id 字段（{p}）")
    return hotspots


def load_hotspots(date_str, track_id=None):
    """两池合并：公共池 data/hotspots/<date>.json + 赛道池 data/hotspots/tracks/<track_id>/<date>.json。

    - 任一池文件不存在则跳过该池；两池都不存在才报错。
    - 同 hotspot_id 去重，公共池优先（赛道池不应覆盖公共池条目）。
    - 向后兼容：不传 track_id 或无赛道池文件时，行为与旧版完全一致。
    """
    broad_p = os.path.join(DATA_DIR, "hotspots", f"{date_str}.json")
    track_p = (
        os.path.join(DATA_DIR, "hotspots", "tracks", track_id, f"{date_str}.json")
        if track_id else None
    )

    merged, seen = [], set()
    for p in [broad_p, track_p]:
        if not p or not os.path.exists(p):
            continue
        for h in _read_hotspot_file(p):
            if h["hotspot_id"] in seen:
                continue
            seen.add(h["hotspot_id"])
            merged.append(h)

    if not merged:
        raise FileNotFoundError(
            f"该日期没有任何热点池文件:\n"
            f"  公共池: {broad_p}\n"
            + (f"  赛道池: {track_p}\n" if track_p else "")
            + f"请先写入热点（格式参考 config/today-hotspots.demo.json）"
        )
    return merged


def clear_stage_prompts(prompts_dir, stage):
    """清理本轮将重新生成的 prompt，避免页面读到上一轮残留。"""
    if not os.path.isdir(prompts_dir):
        return
    prefix = f"{stage}-"
    for name in os.listdir(prompts_dir):
        if name.startswith(prefix) and name.endswith(".txt"):
            os.remove(os.path.join(prompts_dir, name))


def load_match_results(output_dir):
    """读取已保存的 match 回贴；generate 阶段据此只处理非 skip 热点。"""
    inbox_dir = os.path.join(output_dir, "_inbox")
    if not os.path.isdir(inbox_dir):
        return {}

    results = {}
    for name in sorted(os.listdir(inbox_dir)):
        if not (name.startswith("match-") and name.endswith(".json")):
            continue
        path = os.path.join(inbox_dir, name)
        data = read_json(path)
        if not isinstance(data, dict):
            raise ValueError(f"match 回贴必须是 JSON 对象: {path}")
        hotspot_id = data.get("hotspot_id") or name[len("match-") : -len(".json")]
        tier = data.get("tier")
        if tier not in {"strong_pick", "maybe", "skip"}:
            raise ValueError(f"{path}: match.tier 非法，应为 strong_pick/maybe/skip，收到 {tier!r}")
        results[str(hotspot_id)] = tier
    return results


def load_track_analysis(track_id):
    """读取赛道专属博士分析层；没有文件时给出显式占位说明。"""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "", str(track_id or ""))
    path = os.path.join(PROMPTS_DIR, "分析提示词", safe, "赛道分析.md")
    if not safe or not os.path.exists(path):
        return "本赛道尚未配置专属博士分析层；请按共享生成方法论输出。"
    with open(path, "r", encoding="utf-8") as f:
        return _pl.strip_comments(f.read()).strip()


def load_config(subdir, item_id, label):
    p = os.path.join(CONFIG_DIR, subdir, f"{item_id}.json")
    if not os.path.exists(p):
        raise FileNotFoundError(f"{label} 配置文件不存在: {p}")
    return read_json(p)


def build_match_vars(date_str, account, effective_track, hotspot, platform_json=None, positioning_json=None):
    """组装 热点匹配判断.md 所需变量。"""
    bridge = effective_track.get("bridge") or {}
    platform_json = platform_json or {}
    positioning_json = positioning_json or {}
    return {
        "date":            date_str,
        "hotspot_id":      hotspot.get("hotspot_id", ""),
        "track":           effective_track.get("track_name", ""),
        "account_match_card": build_account_match_card(account, effective_track, platform_json, positioning_json),
        "track_json":      effective_track,
        "anxiety_anchors": ", ".join(effective_track.get("anxiety_anchors") or []),
        "internal_lens":   bridge.get("internal_lens", ""),
        "forbidden_terms": bridge.get("forbidden_terms") or [],
        "hotspot":         hotspot,
        "hotspot_title":   hotspot.get("title", ""),
    }


def build_generate_vars(date_str, account, effective_track, hotspot, platform_json, positioning_json):
    """组装 内容生成.md 所需变量。"""
    bridge = effective_track.get("bridge") or {}
    track_id = effective_track.get("track_id")
    return {
        "date":            date_str,
        "hotspot_id":      hotspot.get("hotspot_id", ""),
        "track":           effective_track.get("track_name", ""),
        "account_match_card": build_account_match_card(account, effective_track, platform_json, positioning_json),
        "track_analysis":  load_track_analysis(track_id),
        "track_json":      effective_track,
        "product_value":   effective_track.get("product_value", ""),
        "proof_assets":    effective_track.get("proof_assets") or [],
        "anxiety_anchors": ", ".join(effective_track.get("anxiety_anchors") or []),
        "bridge_motifs":   bridge.get("external_vocab") or [],
        "internal_lens":   bridge.get("internal_lens", ""),
        "external_vocab":  bridge.get("external_vocab") or [],
        "forbidden_terms": bridge.get("forbidden_terms") or [],
        "platform":        platform_json.get("platform_name", platform_json.get("platform_id", "")),
        "platform_json":   platform_json,
        "platform_rules":  build_platform_rules(platform_json),
        "positioning":     positioning_json.get("positioning_name", positioning_json.get("positioning_id", "")),
        "positioning_voice": positioning_json.get("voice", ""),
        "hotspot":         hotspot,
        "hotspot_title":   hotspot.get("title", ""),
    }


DIVIDER = "=" * 72


def make_prompts(account_id, date_str, step, output_dir, print_to_stdout=True):
    """主生成函数，返回 {hotspot_id: {match?: str, generate?: str}} 字典。"""
    account   = load_account(account_id)
    ensure_account_active(account)
    memory    = account.get("memory") or {}
    track_id  = account.get("track_id") or account.get("memory", {}).get("track_id")
    platform_id   = account.get("platform_id")
    positioning_id = account.get("positioning_id")

    if not track_id:
        raise ValueError("账号文件中缺少 track_id 字段")

    # 两池合并：公共池（全账号共享）+ 本赛道定向池（只喂本赛道账号）
    hotspots  = load_hotspots(date_str, track_id)

    track_json      = load_config("tracks", track_id, "赛道")
    review_flags    = ensure_track_approved(track_json)
    platform_json   = load_config("platforms", platform_id, "平台") if platform_id else {}
    positioning_json = load_config("positionings", positioning_id, "人设") if positioning_id else {}

    effective_track = build_effective_track(track_json, memory)

    prompts_dir = os.path.join(output_dir, "prompts")
    os.makedirs(prompts_dir, exist_ok=True)
    if step in ("match", "all"):
        clear_stage_prompts(prompts_dir, "match")
    if step in ("generate", "all"):
        clear_stage_prompts(prompts_dir, "generate")

    result = {}
    match_results = {}
    if step == "generate":
        match_results = load_match_results(output_dir)
        if not match_results:
            raise ValueError(
                "还没有保存 match 判断结果，不能生成内容提示词。"
                f"请先把判断回贴保存到 data/runs/{date_str}/{account_id}/_inbox/match-<hotspot_id>.json"
            )

    for hotspot in hotspots:
        hid = hotspot["hotspot_id"]
        result[hid] = {}

        if step in ("match", "all"):
            vars_match = build_match_vars(date_str, account, effective_track, hotspot, platform_json, positioning_json)
            prompt_text = render_template("hotspot-match", vars_match)
            fname = os.path.join(prompts_dir, f"match-{hid}.txt")
            write_text(fname, prompt_text)
            result[hid]["match"] = fname

            if print_to_stdout:
                print(f"\n{DIVIDER}")
                print(f"# MATCH PROMPT · {hid}")
                print(f"# 保存回贴为: data/runs/{date_str}/{account_id}/_inbox/match-{hid}.json")
                print(DIVIDER)
                print(prompt_text)

        if step in ("generate", "all"):
            if step == "generate" and match_results.get(hid) != "strong_pick" and match_results.get(hid) != "maybe":
                continue
            vars_gen = build_generate_vars(date_str, account, effective_track, hotspot, platform_json, positioning_json)
            prompt_text = render_template("content-generate", vars_gen)
            fname = os.path.join(prompts_dir, f"generate-{hid}.txt")
            write_text(fname, prompt_text)
            result[hid]["generate"] = fname

            if print_to_stdout:
                print(f"\n{DIVIDER}")
                print(f"# GENERATE PROMPT · {hid}")
                print(f"# 保存回贴为: data/runs/{date_str}/{account_id}/_inbox/generate-{hid}.json")
                print(DIVIDER)
                print(prompt_text)

    # 创建 manifest 骨架（ingest 时补充完整）
    manifest_path = os.path.join(output_dir, "manifest.json")
    if not os.path.exists(manifest_path):
        import datetime
        manifest = {
            "account_id": account_id,
            "date": date_str,
            "prompts_generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "model": "（人工填写：你用的模型名，如 claude-opus-4-8 / gpt-4o）",
            "hotspot_ids": [h["hotspot_id"] for h in hotspots],
            "hotspot_tiers": {},
            "feedback_archived": False,
            **review_flags,
            "review_status": mvp_policy.track_review_status(track_json),
        }
        write_json(manifest_path, manifest)

    return result


# ── selftest ──────────────────────────────────────────────────────────────────

def selftest():
    print("─── make-prompt.py --selftest ───")
    today = str(_date_cls.today())

    # 用真实文件测试：动态挑一个赛道已定稿(approved/reference)的账号，
    # 避免某赛道被 paused 时 selftest 误挂（paused 赛道不允许跑批是预期行为，不是 bug）。
    account_id = None
    accounts_dir = os.path.join(DATA_DIR, "accounts")
    for fn in sorted(os.listdir(accounts_dir)):
        if not fn.endswith(".json"):
            continue
        try:
            acc = read_json(os.path.join(accounts_dir, fn))
            tj  = load_config("tracks", acc.get("track_id"), "赛道")
        except Exception:
            continue
        if (tj.get("status") or "draft") in APPROVED_STATUSES:
            account_id = acc["account_id"]
            break
    assert account_id, "没有任何赛道已定稿的账号，无法跑 selftest"
    date_str   = "2026-06-10"

    # 确认热点文件存在
    hs_path = os.path.join(DATA_DIR, "hotspots", f"{date_str}.json")
    assert os.path.exists(hs_path), f"热点文件不存在: {hs_path}"

    # 在临时目录输出
    with tempfile.TemporaryDirectory() as tmpdir:
        run_dir = os.path.join(tmpdir, date_str, account_id)
        os.makedirs(run_dir, exist_ok=True)

        # 生成全部 prompts（不打印到终端）
        result = make_prompts(account_id, date_str, "all", run_dir, print_to_stdout=False)
        assert result, "返回空字典，未生成任何 prompt"

        for hid, files in result.items():
            # match prompt
            match_f = files.get("match")
            assert match_f and os.path.exists(match_f), f"match prompt 文件不存在: {match_f}"
            text = open(match_f, encoding="utf-8").read()
            # 白名单占位符应已全部替换
            for ph in _pl.KNOWN_PLACEHOLDERS:
                assert ("{" + ph + "}") not in text, f"{hid} match prompt 仍含未替换占位符: {{{ph}}}"
            # 示例 JSON 花括号应保留
            assert "{" in text and "}" in text, f"{hid} match prompt 花括号被清空"
            print(f"✅ match-{hid}: 占位符全替换、示例 JSON 花括号保留")

            # generate prompt
            gen_f = files.get("generate")
            assert gen_f and os.path.exists(gen_f), f"generate prompt 文件不存在: {gen_f}"
            text = open(gen_f, encoding="utf-8").read()
            for ph in _pl.KNOWN_PLACEHOLDERS:
                assert ("{" + ph + "}") not in text, f"{hid} generate prompt 仍含未替换占位符: {{{ph}}}"
            assert "{" in text and "}" in text, f"{hid} generate prompt 花括号被清空"
            print(f"✅ generate-{hid}: 占位符全替换、示例 JSON 花括号保留")

        # manifest 骨架生成
        manifest_f = os.path.join(run_dir, "manifest.json")
        assert os.path.exists(manifest_f), "manifest.json 未生成"
        m = read_json(manifest_f)
        assert m["account_id"] == account_id
        assert m["date"] == date_str
        print("✅ manifest.json 骨架已生成")

        # 账号记忆合并：bridge_directions 应注入生效赛道
        account = load_account(account_id)
        memory  = account.get("memory") or {}
        track   = load_config("tracks", account["track_id"], "赛道")
        eff     = build_effective_track(track, memory)
        bridge  = eff.get("bridge") or {}
        assert bridge.get("search_directions") or bridge.get("forbidden_terms"), \
            "build_effective_track 未产出 bridge 字段"
        extra_ft = memory.get("extra_forbidden_terms") or []
        for w in extra_ft:
            assert w in bridge.get("forbidden_terms", []), \
                f"账号额外禁词 '{w}' 未并入生效赛道 forbidden_terms"
        print("✅ build_effective_track: 账号记忆合并正确（禁词并入、bridge_directions 注入）")

    # 错误路径：账号不存在
    try:
        load_account("不存在的账号_xyz")
        assert False, "应该抛出 FileNotFoundError"
    except FileNotFoundError:
        print("✅ 账号不存在时抛出正确错误")

    # 错误路径：热点文件不存在
    try:
        load_hotspots("1900-01-01")
        assert False, "应该抛出 FileNotFoundError"
    except FileNotFoundError:
        print("✅ 热点文件不存在时抛出正确错误")

    # 账号 status 字段不再是跑批开关；缺省也能生成 prompt。
    no_status_account = os.path.join(DATA_DIR, "accounts", "acct-selftest-no-status.json")
    try:
        sample_account = read_json(os.path.join(DATA_DIR, "accounts", f"{account_id}.json"))
        sample_account["account_id"] = "acct-selftest-no-status"
        sample_account["display_name"] = "Selftest no-status account"
        sample_account.pop("status", None)
        write_json(no_status_account, sample_account)
        result = make_prompts("acct-selftest-no-status", date_str, "match", tempfile.mkdtemp(), print_to_stdout=False)
        assert result, "无 status 账号应该能生成 prompt"
        print("✅ 账号缺省 status 也能 make-prompt")
    finally:
        try:
            os.remove(no_status_account)
        except FileNotFoundError:
            pass

    # internal MVP 路径：draft 赛道可生成 prompt，但必须带审核标记
    draft_track_id = "selftest-draft-track"
    draft_track = os.path.join(CONFIG_DIR, "tracks", f"{draft_track_id}.json")
    draft_account = os.path.join(DATA_DIR, "accounts", "acct-selftest-draft-track.json")
    try:
        sample_track = read_json(os.path.join(CONFIG_DIR, "tracks", track["track_id"] + ".json"))
        sample_track["track_id"] = draft_track_id
        sample_track["track_name"] = "Selftest draft track"
        sample_track["status"] = "draft"
        write_json(draft_track, sample_track)
        sample_account = read_json(os.path.join(DATA_DIR, "accounts", f"{account_id}.json"))
        sample_account["account_id"] = "acct-selftest-draft-track"
        sample_account["display_name"] = "Selftest draft track account"
        sample_account["track_id"] = draft_track_id
        sample_account.pop("status", None)
        write_json(draft_account, sample_account)
        run_dir = tempfile.mkdtemp()
        make_prompts("acct-selftest-draft-track", date_str, "match", run_dir, print_to_stdout=False)
        manifest = read_json(os.path.join(run_dir, "manifest.json"))
        assert manifest["needs_human_review"] is True
        assert manifest["formal_approval"] is False
        assert manifest["mvp_internal_only"] is True
        print("✅ draft 赛道会被 make-prompt 标记为 internal MVP 内部产物")
    finally:
        for p in [draft_account, draft_track]:
            try:
                os.remove(p)
            except FileNotFoundError:
                pass

    print("\n🎉 make-prompt.py --selftest 全过")
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="拼 prompt，供人工粘给外部 LLM")
    ap.add_argument("account_id", nargs="?", help="账号 ID（data/accounts/<id>.json）")
    ap.add_argument("--date", default=str(_date_cls.today()), metavar="YYYY-MM-DD",
                    help="热点日期，默认今天")
    ap.add_argument("--step", choices=["match", "generate", "all"], default="all",
                    help="match=只出筛选 prompt；generate=只出内容生成；all（默认）两步都出")
    ap.add_argument("--no-print", action="store_true",
                    help="只写文件，不打印到终端")
    ap.add_argument("--selftest", action="store_true",
                    help="离线自测（不调 LLM）")
    args = ap.parse_args()

    if args.selftest:
        sys.exit(selftest())

    if not args.account_id:
        ap.print_help()
        sys.exit(1)

    date_str   = args.date
    account_id = args.account_id

    # 验证日期格式
    import re as _re
    if not _re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        print(f"错误：日期格式应为 YYYY-MM-DD，收到: {date_str}", file=sys.stderr)
        sys.exit(1)

    run_dir = os.path.join(DATA_DIR, "runs", date_str, account_id)
    os.makedirs(run_dir, exist_ok=True)

    try:
        result = make_prompts(account_id, date_str, args.step, run_dir,
                              print_to_stdout=not args.no_print)
    except (FileNotFoundError, ValueError) as e:
        print(f"\n❌ 错误：{e}", file=sys.stderr)
        sys.exit(1)

    total_match    = sum(1 for v in result.values() if v.get("match"))
    total_generate = sum(1 for v in result.values() if v.get("generate"))

    print(f"\n✅ Prompt 生成完成")
    print(f"   账号: {account_id}  日期: {date_str}  热点数: {len(result)}")
    if total_match:
        print(f"   match prompts ({total_match} 条) → data/runs/{date_str}/{account_id}/prompts/match-*.txt")
    if total_generate:
        print(f"   generate prompts ({total_generate} 条) → data/runs/{date_str}/{account_id}/prompts/generate-*.txt")
    print(f"\n下一步：")
    print(f"  1. 把 prompts/ 里的 .txt 文件内容逐条粘给外部 LLM")
    print(f"  2. 把回贴保存为 data/runs/{date_str}/{account_id}/_inbox/match-<id>.json")
    print(f"     和 data/runs/{date_str}/{account_id}/_inbox/generate-<id>.json")
    print(f"  3. python3 scripts/ingest.py {account_id} data/runs/{date_str}/{account_id}/_inbox/ --date {date_str}")


if __name__ == "__main__":
    main()
