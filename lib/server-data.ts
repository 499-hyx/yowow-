// GET /api/options 的配置读取层。
// 这里只把 config/ 里的赛道、平台、人设和种子账号装配成 onboarding 选项；
// 不生成今日内容，不写 data/today，不参与 scripts/ingest.py 的安装闸门。
// 旧 warm-start / toBoard / gateVisible 预览辅助已移出活路径，见 docs/archive/code-history/。

import fs from "node:fs";
import path from "node:path";

import {
  scanInternal,
  type PersonaOption,
  type PlatformOption,
  type StoredAccount,
  type TrackOption,
} from "@/lib/adaptation-types";

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

function trackJsonOf(trackId: string): TrackJson | null {
  const p = path.join(CONFIG_DIR, "tracks", `${trackId}.json`);
  return fs.existsSync(p) ? readJson<TrackJson>(p) : null;
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
