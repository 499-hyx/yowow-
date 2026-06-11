// engine-bridge · 独立站服务端「引擎薄壳」（Node 运行时，跑在 Vercel serverless 上）。
//
// 设计铁律（与 skills/adaptation-engine 的 python 引擎完全一致）：
//   - 这里【零】方法论、零桥梁内容。「怎么搭桥、怎么写、怎么判」全在 prompts/*.md + config/tracks/*.json。
//     本文件只做：读模板 → 变量替换 → 调 Claude → 解析装配。换赛道只改 config + prompts，不改本文件。
//   - LLM 走环境变量，绝不写死：ANTHROPIC_API_KEY（必填）、MODEL_NAME（默认 claude-sonnet-4-6）、
//     ANTHROPIC_BASE_URL（默认 https://api.anthropic.com）。
//   - 无 ANTHROPIC_API_KEY → 抛 NoCredentials；路由据此降级为「暖启动样板」，绝不伪造。
//
// 这是 python run_engine.engine_llm 的 TS 同源实现，读同一套 prompts/*.md（单一真理）。
// 二者都是薄壳：python 跑流水线/CLI，TS 跑独立站 serverless。

import fs from "node:fs";
import path from "node:path";

import type { AdaptationOutput } from "@/lib/adaptation-types";

export class NoCredentials extends Error {}
export class LLMError extends Error {}

const ROOT = process.cwd();
const PROMPTS_DIR = path.join(ROOT, "prompts");
const CONFIG_DIR = path.join(ROOT, "config");

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_VERSION = "2023-06-01";

// 占位符白名单（与 skills/adaptation-engine/prompt_loader.KNOWN_PLACEHOLDERS 同步）。
const KNOWN_PLACEHOLDERS = [
  "date",
  "track", "track_json",
  "business_seed", "product_value", "proof_assets", "anxiety_anchors",
  "bridge_motifs", "internal_lens", "external_vocab", "forbidden_terms",
  "platform", "platform_json", "positioning", "positioning_voice",
  "hotspot", "hotspot_raw", "hotspot_title",
] as const;

export type EngineOutput = AdaptationOutput & {
  relevance_score: number;
  naturalness_score: number;
};

// ── 配置读取（赛道/平台/定位/账号） ──
function readJson<T = unknown>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}
export function loadTrack(id: string) {
  return readJson<Record<string, unknown>>(path.join(CONFIG_DIR, "tracks", `${id}.json`));
}
export function loadPlatform(id: string) {
  return readJson<Record<string, unknown>>(path.join(CONFIG_DIR, "platforms", `${id}.json`));
}
export function loadPositioning(id: string) {
  return readJson<Record<string, unknown>>(path.join(CONFIG_DIR, "positionings", `${id}.json`));
}

// ── 模板渲染（读 .md → 剥 HTML 注释 → 只替换白名单占位符；示例 JSON 花括号原样保留） ──
function coerce(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
export function render(name: string, variables: Record<string, unknown>): string {
  const file = path.join(PROMPTS_DIR, name.endsWith(".md") ? name : `${name}.md`);
  let text = fs.readFileSync(file, "utf-8").replace(/<!--[\s\S]*?-->/g, "").trim();
  for (const ph of KNOWN_PLACEHOLDERS) {
    const token = `{${ph}}`;
    if (text.includes(token) && ph in variables) {
      text = text.split(token).join(coerce(variables[ph]));
    }
  }
  return text;
}

// ── 从模型输出里稳健抽出 JSON（容忍 ```json 围栏 / 前后多余文字 / 嵌套） ──
export function extractJson<T = unknown>(text: string): T {
  if (!text || !text.trim()) throw new LLMError("LLM 返回空文本");
  const fence = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  let candidate: string | null = fence ? fence[1] : null;
  if (candidate === null) {
    const start = text.indexOf("{");
    if (start < 0) throw new LLMError("LLM 输出里找不到 JSON 对象");
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i += 1) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) {
          candidate = text.slice(start, i + 1);
          break;
        }
      }
    }
    if (candidate === null) throw new LLMError("LLM 输出里 JSON 花括号不配对");
  }
  return JSON.parse(candidate) as T;
}

// ── 调 Claude ──
export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
export function modelName(): string {
  return process.env.MODEL_NAME || DEFAULT_MODEL;
}
export async function complete(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new NoCredentials("未设置 ANTHROPIC_API_KEY；应降级为暖启动样板，不伪造");
  }
  const baseUrl = (process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const version = process.env.ANTHROPIC_VERSION || DEFAULT_VERSION;
  const maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS || 4096);

  const body: Record<string, unknown> = {
    model: modelName(),
    max_tokens: maxTokens,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  };
  if (system) body.system = system;

  let resp: globalThis.Response;
  try {
    resp = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": version,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new LLMError(`Anthropic API 网络错误: ${String(e)}`);
  }
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new LLMError(`Anthropic API HTTP ${resp.status}: ${detail.slice(0, 500)}`);
  }
  const payload = (await resp.json()) as { content?: Array<{ type?: string; text?: string }> };
  const out = (payload.content || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join("");
  if (!out.trim()) throw new LLMError("Anthropic API 返回无文本内容");
  return out;
}

// ── 装配（注入四 id、剥 schema 外的辅助键）。纯机械，零方法论。──
const ALLOWED_OUTPUT_KEYS = new Set([
  "hotspot_id", "track_id", "platform_id", "positioning_id",
  "relevance_score", "naturalness_score", "recommendation", "forced_flag",
  "skip_reason", "bridge_paths", "chosen_path_id", "content", "external_terms_check",
]);
const ALLOWED_PATH_KEYS = new Set([
  "path_id", "phenomenon", "real_problem", "track_relation",
  "product_value_support", "platform_expression", "naturalness_note",
]);

type Ids = { hotspot_id: string; track_id: string; platform_id: string; positioning_id: string };

function assemble(parsed: Record<string, unknown>, ids: Ids): EngineOutput {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (ALLOWED_OUTPUT_KEYS.has(k)) out[k] = v;
  }
  out.hotspot_id = ids.hotspot_id;
  out.track_id = ids.track_id;
  out.platform_id = ids.platform_id;
  out.positioning_id = ids.positioning_id;
  const rawPaths = Array.isArray(out.bridge_paths) ? (out.bridge_paths as Record<string, unknown>[]) : [];
  out.bridge_paths = rawPaths.map((p) => {
    const np: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (ALLOWED_PATH_KEYS.has(k)) np[k] = v;
    return np;
  });
  return out as EngineOutput;
}

// ── 主入口：一条热点 × 赛道 × 平台 × 定位 → 一条适配产物（Step6 内容方案） ──
export type GenerateArgs = {
  hotspot: Record<string, unknown> & { hotspot_id: string; date?: string };
  trackId: string;
  platformId: string;
  positioningId: string;
  overrides?: { extra_external_vocab?: string[]; extra_forbidden_terms?: string[] };
  // 账号记忆合并后的生效赛道配置（server-data.buildEffectiveTrack 的产物）。
  // 不传则从 config/tracks/<id>.json 读。本文件不做任何合并判断，只透传。
  track?: Record<string, unknown>;
};

export async function generateAdaptation(args: GenerateArgs): Promise<EngineOutput> {
  const track = args.track ?? loadTrack(args.trackId);
  const platform = loadPlatform(args.platformId);
  const positioning = loadPositioning(args.positioningId);
  const bridge = (track.bridge as Record<string, unknown>) || {};
  const externalVocab = [
    ...(((bridge.external_vocab as string[]) || [])),
    ...((args.overrides?.extra_external_vocab as string[]) || []),
  ];
  const forbidden = [
    ...(((bridge.forbidden_terms as string[]) || [])),
    ...((args.overrides?.extra_forbidden_terms as string[]) || []),
  ];

  const variables: Record<string, unknown> = {
    date: args.hotspot.date || "",
    track: track.track_name || track.track_id || "",
    track_json: track,
    product_value: track.product_value || "",
    proof_assets: track.proof_assets || [],
    anxiety_anchors: track.anxiety_anchors || [],
    bridge_motifs: externalVocab,
    internal_lens: bridge.internal_lens || "",
    external_vocab: externalVocab,
    forbidden_terms: forbidden,
    platform: platform.platform_name || platform.platform_id || "",
    platform_json: platform,
    positioning: positioning.positioning_name || positioning.positioning_id || "",
    positioning_voice: positioning.voice || "",
    hotspot: args.hotspot,
  };

  const prompt = render("content-generate", variables);
  const text = await complete(
    prompt,
    "你是多赛道内容适配引擎。严格按用户提示词里的输出格式，只输出 JSON。",
  );
  const parsed = extractJson<Record<string, unknown>>(text);
  return assemble(parsed, {
    hotspot_id: args.hotspot.hotspot_id,
    track_id: args.trackId,
    platform_id: args.platformId,
    positioning_id: args.positioningId,
  });
}

// ── Step5 热点筛选（先筛后生成）：读 prompts/hotspot-match.md → 调 Claude → 三档判定 ──
// 判断标准（什么算自然、什么算牵强）全在模板可编辑区，本函数零方法论。
export type MatchArgs = {
  hotspot: Record<string, unknown> & { hotspot_id: string; date?: string };
  trackId: string;
  track?: Record<string, unknown>; // 账号记忆合并后的生效赛道配置（含 bridge.search_directions）
};
export type MatchResult = {
  tier: "strong_pick" | "maybe" | "skip";
  relevance_score?: number;
  naturalness_score?: number;
  why_relevant?: string;
  skip_reason?: string;
};

export async function matchHotspot(args: MatchArgs): Promise<MatchResult> {
  const track = args.track ?? loadTrack(args.trackId);
  const bridge = (track.bridge as Record<string, unknown>) || {};
  const prompt = render("hotspot-match", {
    date: args.hotspot.date || "",
    track: track.track_name || track.track_id || "",
    track_json: track,
    anxiety_anchors: track.anxiety_anchors || [],
    internal_lens: bridge.internal_lens || "",
    forbidden_terms: bridge.forbidden_terms || [],
    hotspot: args.hotspot,
  });
  const text = await complete(
    prompt,
    "你是热点×赛道相关性判官。严格按用户提示词里的输出格式，只输出 JSON。",
  );
  const parsed = extractJson<Partial<MatchResult>>(text);
  const tier =
    parsed.tier === "strong_pick" || parsed.tier === "maybe" || parsed.tier === "skip"
      ? parsed.tier
      : "skip"; // 档位读不懂 → 按最保守处理，不硬推
  return {
    tier,
    relevance_score: typeof parsed.relevance_score === "number" ? parsed.relevance_score : undefined,
    naturalness_score:
      typeof parsed.naturalness_score === "number" ? parsed.naturalness_score : undefined,
    why_relevant: typeof parsed.why_relevant === "string" ? parsed.why_relevant : undefined,
    skip_reason: typeof parsed.skip_reason === "string" ? parsed.skip_reason : undefined,
  };
}

// ── Step4 桥梁母题起草（onboarding 用）：读 prompts/bridge-motif.md → 调 Claude → 解析 ──
export type BridgeDraftSeed = {
  business_seed: string;
  product_value: string;
  proof_assets: string[];
  anxiety_anchors: string[];
};
export type BridgeDraft = {
  track_name?: string;
  buyer_job?: string;
  product_value?: string;
  anxiety_anchors?: string[];
  bridge?: { internal_lens?: string; external_vocab?: string[]; forbidden_terms?: string[] };
  example_bridges?: Array<{ hotspot_hint: string; real_problem: string; track_relation: string }>;
};

export async function draftBridgeMotif(seed: BridgeDraftSeed, date = ""): Promise<BridgeDraft> {
  const prompt = render("bridge-motif", {
    date,
    business_seed: seed.business_seed,
    product_value: seed.product_value,
    proof_assets: seed.proof_assets,
    anxiety_anchors: seed.anxiety_anchors,
  });
  const text = await complete(
    prompt,
    "你是赛道桥梁母题起草器。严格按用户提示词里的输出格式，只输出 JSON。不确定就写保守，留给博士定稿。",
  );
  return extractJson<BridgeDraft>(text);
}
