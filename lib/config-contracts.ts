// config-contracts.ts — 配置规范化类型和转换工具。
//
// 用途：让历史/新格式的 track/account/platform 配置在前端读取时有统一形状。
// 这里不保存配置，不生成内容；长期事实源仍是 config/ 与 data/accounts/。

export type MaintainerTrackConfig = {
  track_id: string;
  track_name: string;
  audience: string;
  business_goals: string[];
  suitable_hotspot_types: string[];
  unsuitable_hotspot_types: string[];
  natural_connection_patterns: string[];
  forced_connection_patterns: string[];
  forbidden_terms: string[];
  skip_rules: string[];
  tone_rules: string[];
  draft_requirements: string[];
};

export type MaintainerAccountConfig = {
  account_id: string;
  account_name: string;
  track_id: string;
  platforms: string[];
  positioning: string;
  target_audience: string;
  business_offers: string[];
  content_style: string;
  forbidden_topics: string[];
  memory_notes: string[];
  feedback_preferences: string[];
};

export type MaintainerPlatformConfig = {
  platform_id: string;
  platform_name: string;
  content_style: string;
  title_rules: string[];
  body_rules: string[];
  forbidden_patterns: string[];
  recommended_structure: string;
};

type JsonRecord = Record<string, any>;

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function one(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function exampleBridgeTexts(track: JsonRecord, key: string): string[] {
  return Array.isArray(track.example_bridges)
    ? track.example_bridges.map((item: JsonRecord) => one(item?.[key])).filter(Boolean)
    : [];
}

export function normalizeTrackConfig(track: JsonRecord): MaintainerTrackConfig {
  const bridge = track.bridge ?? {};
  const doctrine = track.analysis_doctrine ?? {};
  return {
    track_id: one(track.track_id),
    track_name: one(track.track_name),
    audience: one(track.audience ?? track.buyer?.who),
    business_goals: list(track.commercial_goal),
    suitable_hotspot_types: [
      ...list(bridge.search_directions),
      ...exampleBridgeTexts(track, "hotspot_hint"),
    ],
    unsuitable_hotspot_types: [
      ...list(doctrine.no_touch),
      ...list(track.unsuitable_hotspot_types),
    ],
    natural_connection_patterns: [
      ...list(bridge.external_vocab),
      ...exampleBridgeTexts(track, "track_relation"),
    ],
    forced_connection_patterns: [
      ...list(bridge.forbidden_terms),
      one(doctrine.step_zero_gate),
    ].filter(Boolean),
    forbidden_terms: list(bridge.forbidden_terms),
    skip_rules: [
      one(doctrine.step_zero_gate),
      ...list(doctrine.no_touch),
      ...list(track.skip_rules),
    ].filter(Boolean),
    tone_rules: [
      one(track.content_style),
      one(doctrine.stance),
      one(doctrine.controversy_rule),
    ].filter(Boolean),
    draft_requirements: [
      one(track.product_value),
      ...list(track.proof_assets),
    ].filter(Boolean),
  };
}

export function normalizeAccountConfig(account: JsonRecord): MaintainerAccountConfig {
  const memory = account.memory ?? {};
  return {
    account_id: one(account.account_id),
    account_name: one(account.display_name ?? account.account_name),
    track_id: one(account.track_id),
    platforms: list(account.platforms).length ? list(account.platforms) : [one(account.platform_id)].filter(Boolean),
    positioning: one(account.positioning_id ?? account.positioning_name),
    target_audience: one(memory.audience),
    business_offers: [
      one(memory.business),
      one(memory.product_value),
      ...list(memory.proof_assets),
    ].filter(Boolean),
    content_style: one(memory.content_style),
    forbidden_topics: [
      ...list(memory.banned_topics),
      ...list(memory.extra_forbidden_terms),
    ],
    memory_notes: [
      ...list(memory.anxiety_anchors),
      ...list(memory.extra_external_vocab),
    ],
    feedback_preferences: list(memory.feedback_preferences),
  };
}

export function normalizePlatformConfig(platform: JsonRecord): MaintainerPlatformConfig {
  return {
    platform_id: one(platform.platform_id),
    platform_name: one(platform.platform_name),
    content_style: one(platform.content_form ?? platform.distribution_logic),
    title_rules: [
      one(platform.title_logic),
      one(platform.hook?.principle),
    ].filter(Boolean),
    body_rules: [
      one(platform.length_norm),
      ...list(platform.expression_rules),
      one(platform.conversion_path),
    ].filter(Boolean),
    forbidden_patterns: [
      ...list(platform.penalizes),
      ...list(platform.forbidden_patterns),
    ],
    recommended_structure: one(platform.length_norm),
  };
}

export function validateMaintainerConfig(
  kind: "track" | "account" | "platform",
  data: MaintainerTrackConfig | MaintainerAccountConfig | MaintainerPlatformConfig,
): string[] {
  const errors: string[] = [];
  const requireString = (key: string, value: string) => {
    if (!value) errors.push(`${kind}.${key} is required`);
  };
  const requireList = (key: string, value: string[]) => {
    if (!value.length) errors.push(`${kind}.${key} must not be empty`);
  };

  if (kind === "track") {
    const track = data as MaintainerTrackConfig;
    requireString("track_id", track.track_id);
    requireString("track_name", track.track_name);
    requireString("audience", track.audience);
    requireList("business_goals", track.business_goals);
    requireList("natural_connection_patterns", track.natural_connection_patterns);
    requireList("forbidden_terms", track.forbidden_terms);
    requireList("skip_rules", track.skip_rules);
    requireList("draft_requirements", track.draft_requirements);
  }
  if (kind === "account") {
    const account = data as MaintainerAccountConfig;
    requireString("account_id", account.account_id);
    requireString("account_name", account.account_name);
    requireString("track_id", account.track_id);
    requireList("platforms", account.platforms);
    requireString("positioning", account.positioning);
    requireString("target_audience", account.target_audience);
    requireList("business_offers", account.business_offers);
  }
  if (kind === "platform") {
    const platform = data as MaintainerPlatformConfig;
    requireString("platform_id", platform.platform_id);
    requireString("platform_name", platform.platform_name);
    requireString("content_style", platform.content_style);
    requireList("title_rules", platform.title_rules);
    requireList("body_rules", platform.body_rules);
    requireList("forbidden_patterns", platform.forbidden_patterns);
    requireString("recommended_structure", platform.recommended_structure);
  }

  return errors;
}
