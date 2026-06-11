// T-M4.0（部署脚手架）· 前端 ↔ 服务端 API 契约类型。
// typecheck 级：路由桩与页面据此对齐；部署窗口把桩体换成真实实现，契约不变。
// 服务端实现落点（部署接线）：
//   /api/onboarding → lib/onboarding.mjs(assembleAccountProfile) + scripts/draft_track.py + scripts/first_content.py + Turso 写库
//   /api/today      → 查 generation(按 account/当天) + scripts/daily_recommend.py(排序+explain) + scripts/content_gate.py
//   /api/feedback   → scripts/feedback_store.py(六维落库) + scripts/feedback_reflow.py(次日生效)

import type {
  AccountMemory,
  AccountProfile,
  AdaptationOutput,
  DailyBoard,
  FeedbackPayload,
  FirstContentResult,
  HotspotMeta,
  HotspotMetaMap,
  OnboardingAnswers,
  PersonaOption,
  PlatformOption,
  StoredAccount,
  TrackEcho,
  TrackOption,
} from "@/lib/adaptation-types";

export type Ids = {
  tenant_id: string;
  track_id: string;
  platform_id: string;
  positioning_id: string;
};

// GET /api/options —— 赛道/平台/人设选项 + 种子账号，全部从 config/ 读出
// （加赛道=加 tracks/<id>.json；加种子账号=加 account-profiles/<id>.json；零代码）
export type OptionsResponse = {
  tracks: TrackOption[];
  platforms: PlatformOption[];
  personas: PersonaOption[];
  seedAccounts: StoredAccount[]; // config/account-profiles/*.json + 赛道记忆 + 博士桥梁方向 装配而成
};

// POST /api/onboarding
export type OnboardingRequest = { answers: OnboardingAnswers; ids?: Partial<Ids> };
export type OnboardingResponse = {
  account: AccountProfile;
  draftEcho: TrackEcho;
  firstContent: FirstContentResult;
  memory: AccountMemory; // 服务端装配好的账号定位记忆（答案+赛道配置+博士桥梁方向），前端落账号库
  options?: { platforms: PlatformOption[]; personas: PersonaOption[] };
  notice?: string; // 人话提示（如：示例模式说明），可直接渲染
};

// POST /api/today —— 基于账号记忆出今日板（先有账号记忆，再有每日推荐）。
// GET 仍兼容（query 版，无记忆注入），前端一律走 POST。
export type TodayRequest = {
  account: Pick<AccountProfile, "account_id" | "display_name" | "track_id" | "platform_id" | "positioning_id">;
  memory?: AccountMemory;
};
export type TodayResponse = {
  account: AccountProfile;
  board: DailyBoard;
  meta: HotspotMetaMap;
  mode?: "live" | "sample"; // live=实时生成；sample=暖启动样板（未接生成服务）
  notice?: string;          // 人话提示横幅（可为空）
};

// POST /api/regenerate —— 单条热点重新生成（实时模式可用；样板模式诚实拒绝）
export type RegenerateRequest = {
  hotspot_id: string;
  track_id: string;
  platform_id: string;
  positioning_id: string;
  memory?: AccountMemory; // 账号记忆同样注入重生成
};
export type RegenerateResponse = {
  ok: boolean;
  output?: AdaptationOutput;
  meta?: HotspotMeta;
  reason?: string; // ok=false 时的人话原因
};

// POST /api/feedback
export type FeedbackOutputRef = {
  hotspot_id: string;
  track_id: string;
  platform_id: string;
  positioning_id: string;
};
export type FeedbackRequest = { output_ref: FeedbackOutputRef; payload: FeedbackPayload };
export type FeedbackResponse = { ok: boolean; feedback_id?: string };
