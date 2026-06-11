// T-M4.0 · 适配系统前端共享类型（typecheck 级骨架，待部署接 API/DB）
//
// 这里的 TS 类型是前端组件的**契约镜像**——字段以 adaptation-core/schemas/*.json 为最终真理，
// 本文件只是把它们翻成 TS 形状给 onboarding / 今日推荐 组件用。
// 服务端契约对应：lib/onboarding.mjs（7 问→AccountProfile）、scripts/daily_recommend.py
// （排序+为什么推）、scripts/first_content.py（首条内容）、scripts/feedback_store.py（六维反馈）。
//
// I3 红线：任何会渲染给用户的字符串，绝不出现内部术语/分数名。组件只展示「热点一句话 +
// 为什么推（人话，服务端 explain_recommendation 算好）+ 推荐度」，不甩 relevance/naturalness 分。

export type Recommendation = "strong_pick" | "maybe" | "skip";
export type AccountStatus = "onboarding" | "active" | "paused";

// 对外绝对禁词 + 分数名（与 daily_recommend.INTERNAL_OR_SCORE 同源）——客户端兜底自检用
// 注：「大跨度联想」按博士 2026-06 批注解禁外显，已从禁词移除。
export const INTERNAL_OR_SCORE: string[] = [
  "远迁移", "far transfer", "OOD", "in-distribution", "范式转移",
  "relevance", "naturalness", "相关度分", "自然度分",
];

export function scanInternal(text: string): string[] {
  const low = text.toLowerCase();
  return INTERNAL_OR_SCORE.filter((w) =>
    /^[\x00-\x7F]+$/.test(w) ? low.includes(w.toLowerCase()) : text.includes(w),
  );
}

// 推荐度 → 用户可见标签（绝不显示分数）
export function recommendationLabel(rec: Recommendation): string {
  if (rec === "strong_pick") return "强荐";
  if (rec === "maybe") return "可发";
  return "已为你跳过";
}

// ── 适配产物（adaptation-output.schema.json 的前端镜像）──
export type BridgePath = {
  path_id: string;
  phenomenon: string;        // 1 现象
  real_problem: string;      // 2 真实问题
  track_relation: string;    // 3 赛道关系
  product_value_support: string; // 4 产品价值
  platform_expression: string;   // 5 平台表达
  naturalness_note?: string; // 后台说明，默认不渲染给用户
};

export type AdaptationContent = {
  topic?: string;
  title?: string;
  body_or_script?: string;
};

export type AdaptationOutput = {
  hotspot_id: string;
  track_id: string;
  platform_id: string;
  positioning_id: string;
  recommendation: Recommendation;
  forced_flag?: boolean;
  skip_reason?: string | null;
  bridge_paths: BridgePath[];
  chosen_path_id?: string | null;
  content?: AdaptationContent | null;
  external_terms_check?: boolean;
  // relevance_score / naturalness_score 故意不放进前端视图模型：界面绝不展示分数（I3/I4）。
};

// ── 账号档案（account-profile.schema.json 子集，前端展示/切换用）──
export type AccountProfile = {
  account_id: string;
  tenant_id: string;
  display_name: string;
  track_id: string;
  platform_id: string;
  positioning_id: string;
  daily_quota?: number;
  status: AccountStatus;
};

// ── 今日板视图模型（daily_recommend.rank_and_assemble 的输出形状）──
export type DailyBoard = {
  picks: AdaptationOutput[];
  also_ran: AdaptationOutput[];
  skipped: AdaptationOutput[];
};

// 每条热点的「一句话」与「为什么推」由服务端备好（人话、零术语）
export type HotspotMeta = {
  oneLiner: string;          // 热点一句话（取自 neutral hotspot summary/title）
  reason: string;            // 为什么推给你（explain_recommendation，零术语）
};
export type HotspotMetaMap = Record<string, HotspotMeta>;

export type BoardState = "loading" | "ready" | "error" | "no_pick_today";

// ── 首条内容（first_content.py 的返回形状）──
export type FirstContentStatus = "ready" | "no_pick_today" | "pending_deploy";
export type FirstContentResult = {
  status: FirstContentStatus;
  output?: AdaptationOutput;
  hotspot?: string;
  message?: string;
};

// ── 六维反馈（feedback.schema.json：5 个 1-5 维度 + 1 个开放框）──
export type FeedbackDims = {
  track_relevance: number;
  connection_naturalness: number;
  platform_fit: number;
  persona_fit: number;
  publish_value: number;
};
export type FeedbackPayload = {
  dims: FeedbackDims;
  forced_or_unpublishable_note?: string;
};
export const FEEDBACK_DIM_LABELS: { key: keyof FeedbackDims; label: string }[] = [
  { key: "track_relevance", label: "跟我相关" },
  { key: "connection_naturalness", label: "连接自然" },
  { key: "platform_fit", label: "适合平台" },
  { key: "persona_fit", label: "符合人设" },
  { key: "publish_value", label: "有发布价值" },
];

// ── onboarding 7 问（镜像 lib/onboarding.mjs 的 INTERVIEW；全程人话、零内部词）──
export type InterviewKind = "text" | "multi" | "text_list" | "platform_persona";
export type InterviewQuestion = {
  id: string;
  ask: string;
  kind: InterviewKind;
  allowHelp: boolean;
  options?: string[];
  maps: string;
};

export const INTERVIEW: InterviewQuestion[] = [
  { id: "business", ask: "你主要卖什么产品或服务？", kind: "text", allowHelp: true, maps: "buyer.business / track_name" },
  { id: "audience", ask: "谁会买它？", kind: "text", allowHelp: true, maps: "buyer.who / audience" },
  { id: "commercial_goal", ask: "你发内容，最想达成什么？", kind: "multi", allowHelp: false,
    options: ["直接带货", "建立信任", "招商加盟", "引流获客", "品牌心智", "私域沉淀", "留资询盘"], maps: "commercial_goal" },
  { id: "product_value", ask: "你的东西最大的好，用一句话怎么说？", kind: "text", allowHelp: true, maps: "product_value" },
  { id: "proof_assets", ask: "你能拿出什么让人信你？（可多选）", kind: "multi", allowHelp: true,
    options: ["工厂实拍", "资质证书", "客户案例", "数据效果", "真人测评"], maps: "proof_assets" },
  { id: "anxiety_anchors", ask: "你的客户平时最焦虑或最在意什么？", kind: "text_list", allowHelp: true, maps: "anxiety_anchors" },
  { id: "platform_persona", ask: "先做哪个平台、想用什么人设出镜？", kind: "platform_persona", allowHelp: false, maps: "AccountProfile.platform_id/positioning_id" },
];

export type OnboardingAnswers = {
  business?: string;
  audience?: string;
  commercial_goal?: string[];
  product_value?: string;
  proof_assets?: string[];
  anxiety_anchors?: string[];
  platform_id?: string;
  positioning_id?: string;
  help_requested?: Record<string, boolean>;
  // 多赛道升级（Step1/Step3 扩展；仅前端视图层字段，schema 未动）
  track_id?: string;            // 预置赛道 id；"custom" 表示自定义
  track_custom?: string;        // 自定义赛道时用户的一句话描述
  content_style?: string;       // 内容风格（自由文本，进 business_seed）
  extra_forbidden_terms?: string[]; // 用户自己的禁区（合并进禁用词）
};

export type PlatformOption = { platform_id: string; platform_name: string };
export type PersonaOption = { positioning_id: string; positioning_name: string; voice?: string };

// Step1 赛道卡（全部内容来自 config/tracks/*.json，前端只展示，绝不发明）
export type TrackOption = {
  track_id: string;
  track_name: string;
  tagline: string;              // 取 track.buyer.business
  bridge_preview: string[];     // 取 track.bridge.external_vocab（博士/老板写的对外人话词）
  forbidden_preview: string[];  // 取 track.bridge.forbidden_terms（仅人话禁区，内部词已滤）
  prefill: {
    business?: string;
    audience?: string;
    product_value?: string;
    commercial_goal?: string[];
    proof_assets?: string[];
    anxiety_anchors?: string[];
  };
};

// AI 起草后回显给用户确认的「我理解的你」（external_vocab/forbidden_terms 来自 T-M3.2 起草器，
// 用户只确认对外人话词，不接触 internal_lens）。
export type TrackEcho = {
  business_understood: string;
  goal_understood: string;
  external_vocab: string[];
  forbidden_terms: string[];
};

// ── 账号定位记忆（长期沉淀，每日推荐基于它，不再每次从零开始） ──
// 内容来源：onboarding 答案 / config 种子 / 用户在记忆页编辑。
// bridge_directions = 【已废弃·B档 2026-06-11】搜索方向上收至 tracks/<id>.json 的 bridge.search_directions；此字段仅为兼容旧数据保留，任何逻辑不得再读写。
export type AccountMemory = {
  business?: string;            // 卖什么
  audience?: string;            // 卖给谁
  product_value?: string;       // 产品价值（最大的好）
  anxiety_anchors?: string[];   // 客户焦虑
  proof_assets?: string[];      // 信任证据
  commercial_goal?: string[];   // 商业目标
  content_style?: string;       // 内容风格
  extra_external_vocab?: string[];   // 账号级补充的对外人话词
  extra_forbidden_terms?: string[];  // 账号级禁区词
  banned_topics?: string[];          // 不碰的话题
  bridge_directions?: string[];      // 已废弃，见上注
  understood?: TrackEcho;            // 系统回显的「我理解的你」
};

// 工作台里的一个账号 = 档案 + 记忆 + 展示名
export type StoredAccount = AccountProfile & {
  platform_name?: string;
  positioning_name?: string;
  track_name?: string;
  memory: AccountMemory;
  created_at?: string;
  memory_updated_at?: string; // 记忆最近一次保存时间（控制台展示）
};
