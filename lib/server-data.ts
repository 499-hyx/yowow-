// 服务端数据装配层（Node 运行时）。纯机械：读 config → 拼视图模型。
//
// 铁律：
//   - 零方法论、零桥梁内容。赛道卡、桥梁母题预览、暖启动样板全部来自
//     config/tracks/*.json（博士/老板写）与 config/warm-start/*.json（引擎已验证回放产物）。
//   - 「为什么推」只做模板拼接（取引擎产出的 real_problem + 赛道对外人话词），不做任何判断。
//   - 出口必过 gateVisible：界面可见字符串零内部术语/零该赛道禁用词，命中即降级为 skip（诚实，不硬给）。

import fs from "node:fs";
import path from "node:path";

import {
  scanInternal,
  type AccountMemory,
  type AdaptationOutput,
  type HotspotMeta,
  type HotspotMetaMap,
  type PersonaOption,
  type PlatformOption,
  type StoredAccount,
  type TrackOption,
} from "@/lib/adaptation-types";
import type { TodayResponse } from "@/lib/api-contracts";

const CONFIG_DIR = path.join(process.cwd(), "config");

function readJson<T = Record<string, unknown>>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}
function listJson(dir: string): string[] {
  const full = path.join(CONFIG_DIR, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(full, f));
}

// ── 选项装配（GET /api/options） ──

type TrackJson = {
  track_id: string;
  track_name: string;
  buyer?: { business?: string; who?: string };
  product_value?: string;
  commercial_goal?: string[];
  proof_assets?: string[];
  audience?: string;
  anxiety_anchors?: string[];
  bridge?: { internal_lens?: string; external_vocab?: string[]; forbidden_terms?: string[] };
};

// 禁区预览只露「人话禁区」（如夸大话术），内部分析词不在引导界面出现。
function humanForbidden(terms: string[]): string[] {
  return terms.filter((t) => scanInternal(t).length === 0);
}

export function loadTrackOptions(): TrackOption[] {
  const ORDER = ["education-yowow", "razor-personalcare", "petfood-sourcing", "fitness-coaching"];
  const tracks = listJson("tracks").map((p) => readJson<TrackJson>(p));
  tracks.sort((a, b) => {
    const ia = ORDER.indexOf(a.track_id);
    const ib = ORDER.indexOf(b.track_id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return tracks.map((t) => ({
    track_id: t.track_id,
    track_name: t.track_name,
    tagline: t.buyer?.business ?? "",
    bridge_preview: t.bridge?.external_vocab ?? [],
    forbidden_preview: humanForbidden(t.bridge?.forbidden_terms ?? []),
    prefill: {
      business: t.buyer?.business,
      audience: t.audience,
      product_value: t.product_value,
      commercial_goal: t.commercial_goal,
      proof_assets: t.proof_assets,
      anxiety_anchors: t.anxiety_anchors,
    },
  }));
}

export function loadPlatformOptions(): PlatformOption[] {
  const ORDER = ["xiaohongshu", "shipinhao", "douyin", "bilibili", "youtube"];
  const list = listJson("platforms").map((p) =>
    readJson<{ platform_id: string; platform_name: string }>(p),
  );
  list.sort(
    (a, b) => (ORDER.indexOf(a.platform_id) + 99) % 99 - (ORDER.indexOf(b.platform_id) + 99) % 99,
  );
  return list.map((p) => ({ platform_id: p.platform_id, platform_name: p.platform_name }));
}

export function loadPersonaOptions(): PersonaOption[] {
  return listJson("positionings")
    .map((p) => readJson<{ positioning_id: string; positioning_name: string; voice?: string }>(p))
    .map((p) => ({
      positioning_id: p.positioning_id,
      positioning_name: p.positioning_name,
      voice: p.voice,
    }));
}

export function platformNameOf(platformId: string): string {
  const hit = loadPlatformOptions().find((p) => p.platform_id === platformId);
  return hit?.platform_name ?? platformId;
}

export function trackJsonOf(trackId: string): TrackJson | null {
  const p = path.join(CONFIG_DIR, "tracks", `${trackId}.json`);
  return fs.existsSync(p) ? readJson<TrackJson>(p) : null;
}

// ── 搜索方向（B档迁移：已并入 tracks/<id>.json 的 bridge.search_directions，赛道文件是唯一来源） ──

export function searchDirectionsOf(trackId: string): string[] {
  const track = trackJsonOf(trackId);
  return ((track?.bridge as Record<string, unknown> | undefined)?.search_directions as string[] | undefined) ?? [];
}

// ── 种子账号（config/account-profiles/*.json + 赛道配置 + 桥梁方向 → 工作台账号；纯装配） ──

type AccountProfileJson = {
  account_id: string;
  tenant_id: string;
  display_name: string;
  track_id: string;
  platform_id: string;
  positioning_id: string;
  overrides?: {
    extra_external_vocab?: string[];
    extra_forbidden_terms?: string[];
    tone_note?: string;
    banned_topics?: string[];
  };
  status?: string;
  created_at?: string;
};

export function loadSeedAccounts(): StoredAccount[] {
  const personas = loadPersonaOptions();
  const platforms = loadPlatformOptions();
  return listJson("account-profiles").map((p) => {
    const a = readJson<AccountProfileJson>(p);
    const track = trackJsonOf(a.track_id);
    const humanForbiddenTerms = humanForbidden(track?.bridge?.forbidden_terms ?? []);
    return {
      account_id: a.account_id,
      tenant_id: a.tenant_id,
      display_name: a.display_name,
      track_id: a.track_id,
      platform_id: a.platform_id,
      positioning_id: a.positioning_id,
      status: (a.status as StoredAccount["status"]) ?? "active",
      platform_name: platforms.find((x) => x.platform_id === a.platform_id)?.platform_name,
      positioning_name: personas.find((x) => x.positioning_id === a.positioning_id)?.positioning_name,
      track_name: track?.track_name,
      created_at: a.created_at,
      memory: {
        business: track?.buyer?.business,
        audience: track?.audience,
        product_value: track?.product_value,
        anxiety_anchors: track?.anxiety_anchors ?? [],
        proof_assets: track?.proof_assets ?? [],
        commercial_goal: track?.commercial_goal ?? [],
        content_style: a.overrides?.tone_note,
        extra_external_vocab: a.overrides?.extra_external_vocab ?? [],
        extra_forbidden_terms: a.overrides?.extra_forbidden_terms ?? [],
        banned_topics: a.overrides?.banned_topics ?? [],
        understood: {
          business_understood: track?.buyer?.business ?? "",
          goal_understood: (track?.commercial_goal ?? []).join("、"),
          external_vocab: track?.bridge?.external_vocab ?? [],
          forbidden_terms: [...humanForbiddenTerms, ...(a.overrides?.extra_forbidden_terms ?? [])],
        },
      },
    } satisfies StoredAccount;
  });
}

// ── 账号记忆 → 生效赛道配置（B档定版：方法论永远取自赛道文件，账号只出业务事实和 extra_* 追加） ──
// 注意：internal_lens / search_directions 只来自 tracks/<id>.json，账号记忆无权覆盖。

export function buildEffectiveTrack(
  trackId: string,
  memory?: AccountMemory,
): Record<string, unknown> | null {
  const base = trackJsonOf(trackId);
  if (!base) return null;
  if (!memory) return base as unknown as Record<string, unknown>;
  const bridge = base.bridge ?? {};
  const dirs = ((bridge as Record<string, unknown>).search_directions as string[] | undefined) ?? [];
  return {
    ...base,
    audience: memory.audience || base.audience,
    product_value: memory.product_value || base.product_value,
    anxiety_anchors: memory.anxiety_anchors?.length ? memory.anxiety_anchors : base.anxiety_anchors,
    proof_assets: memory.proof_assets?.length ? memory.proof_assets : base.proof_assets,
    commercial_goal: memory.commercial_goal?.length ? memory.commercial_goal : base.commercial_goal,
    content_style: memory.content_style || undefined,
    banned_topics: memory.banned_topics ?? [],
    bridge: {
      ...bridge,
      external_vocab: [
        ...(bridge.external_vocab ?? []),
        ...(memory.extra_external_vocab ?? []),
      ],
      forbidden_terms: [
        ...(bridge.forbidden_terms ?? []),
        ...(memory.extra_forbidden_terms ?? []),
      ],
      search_directions: dirs.length ? dirs : undefined,
    },
  };
}

// ── 演示热点（部署窗口换成当日真实热点流水线） ──

export type DemoHotspot = Record<string, unknown> & {
  hotspot_id: string;
  date?: string;
  title?: string;
  summary?: string;
};

export function loadDemoHotspots(): DemoHotspot[] {
  const p = path.join(CONFIG_DIR, "today-hotspots.demo.json");
  return readJson<DemoHotspot[]>(p);
}

// ── 「为什么推」与「一句话」：纯模板拼接（取引擎产物字段 + 赛道对外词），零判断 ──

function chosenPath(o: AdaptationOutput) {
  return (
    o.bridge_paths.find((p) => p.path_id === o.chosen_path_id) ?? o.bridge_paths[0] ?? null
  );
}

export function buildMeta(o: AdaptationOutput, hotspotTitle?: string): HotspotMeta {
  const cp = chosenPath(o);
  const oneLiner =
    hotspotTitle ||
    cp?.phenomenon ||
    (o.skip_reason ? o.skip_reason.split(/[，,。]/)[0] : "") ||
    o.hotspot_id;

  let reason = "";
  if (o.recommendation === "strong_pick") {
    const vocab = trackJsonOf(o.track_id)?.bridge?.external_vocab ?? [];
    const anchor = vocab.slice(0, 2).join("、");
    reason = cp
      ? `这条戳的是「${cp.real_problem}」${anchor ? `，正好接你的「${anchor}」` : ""}，可以直接发。`
      : "今天最适合你的一条，可以直接发。";
  } else if (o.recommendation === "maybe") {
    reason = `能接得上，但角度要自己挑，给你 ${o.bridge_paths.length} 条讲法参考。`;
  } else {
    reason = o.skip_reason || "这条跟你的号连不上，硬蹭会伤号，帮你跳过了。";
  }
  return { oneLiner, reason };
}

// ── 出口用词硬门（与 scanInternal 同源 + 该赛道禁用词）。命中即降级，不硬给。 ──

function visibleStrings(o: AdaptationOutput): string[] {
  const out: string[] = [];
  for (const p of o.bridge_paths) {
    out.push(p.phenomenon, p.real_problem, p.track_relation, p.product_value_support, p.platform_expression);
  }
  const c = o.content;
  if (c) out.push(c.topic ?? "", c.title ?? "", c.body_or_script ?? "");
  if (o.skip_reason) out.push(o.skip_reason);
  return out.filter(Boolean);
}

export function gateVisible(o: AdaptationOutput, extraForbidden: string[] = []): AdaptationOutput {
  const forbidden = [...(trackJsonOf(o.track_id)?.bridge?.forbidden_terms ?? []), ...extraForbidden];
  const hit = visibleStrings(o).some(
    (s) => scanInternal(s).length > 0 || forbidden.some((w) => w && s.includes(w)),
  );
  if (!hit) return o;
  return {
    ...o,
    recommendation: "skip",
    skip_reason: "这条成品没过用词自检，先不给你看，点「重新生成」再试一次。",
    bridge_paths: [],
    chosen_path_id: null,
    content: null,
    external_terms_check: false,
  };
}

// ── 暖启动样板装配（config/warm-start/*.json = 引擎已验证回放产物，原样展示） ──

type SeedFile = { track: string; platform: string; positioning: string; file: string };

function listSeeds(): SeedFile[] {
  const dir = path.join(CONFIG_DIR, "warm-start");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const [track, platform, positioning] = f.replace(/\.json$/, "").split("__");
      return { track, platform, positioning, file: path.join(dir, f) };
    })
    .filter((s) => s.track && s.platform && s.positioning);
}

export type WarmBoard = {
  outputs: AdaptationOutput[];
  meta: HotspotMetaMap;
  seedPlatform: string;
  seedPositioning: string;
  exact: boolean;
};

export function loadWarmBoard(
  trackId: string,
  platformId: string,
  positioningId: string,
): WarmBoard | null {
  const seeds = listSeeds().filter((s) => s.track === trackId);
  if (seeds.length === 0) return null;
  const exact = seeds.filter((s) => s.platform === platformId && s.positioning === positioningId);
  const use = exact.length > 0 ? exact : seeds.filter((s) => s.platform === seeds[0].platform);

  const titleById = new Map<string, string>();
  for (const h of loadDemoHotspots()) {
    if (h.title) titleById.set(h.hotspot_id, h.title);
  }

  const outputs: AdaptationOutput[] = [];
  const meta: HotspotMetaMap = {};
  for (const s of use) {
    const o = gateVisible(readJson<AdaptationOutput>(s.file));
    outputs.push(o);
    meta[o.hotspot_id] = buildMeta(o, titleById.get(o.hotspot_id));
  }
  return {
    outputs,
    meta,
    seedPlatform: use[0].platform,
    seedPositioning: use[0].positioning,
    exact: exact.length > 0,
  };
}

// 非 skip 排序：相关 × 自然（分数只在后台用，绝不出现在界面）。heat 不参与。
export function rankScore(o: AdaptationOutput & { relevance_score?: number; naturalness_score?: number }): number {
  return 0.5 * (o.relevance_score ?? 0) + 0.5 * (o.naturalness_score ?? 0);
}

export function toBoard(outputs: AdaptationOutput[]): TodayResponse["board"] {
  const scored = outputs as Array<AdaptationOutput & { relevance_score?: number; naturalness_score?: number }>;
  const picks = scored
    .filter((o) => o.recommendation !== "skip")
    .sort((a, b) => {
      const recRank = (r: string) => (r === "strong_pick" ? 0 : 1);
      return recRank(a.recommendation) - recRank(b.recommendation) || rankScore(b) - rankScore(a);
    })
    // 出口前剥后台分数（界面契约里没有它们，防御性剥除）
    .map(({ relevance_score: _r, naturalness_score: _n, ...rest }) => rest as AdaptationOutput);
  const skipped = scored
    .filter((o) => o.recommendation === "skip")
    .map(({ relevance_score: _r, naturalness_score: _n, ...rest }) => rest as AdaptationOutput);
  return { picks, also_ran: [], skipped };
}
