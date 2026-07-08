// 前端 ↔ API 响应契约类型。
//
// 当前 MVP 是文件驱动：
//   /api/today      只读 data/today/<account_id>/latest.json
//   /api/onboarding 只辅助生成 JSON 草稿，不在线保存
//   /api/regenerate 明确拒绝在线重跑
//   /api/feedback   写 Turso feedback_inbox 或本地 fallback
//
// 注意：这里是 TypeScript 类型对齐层，不是生成/安装入口。正式安装 today/latest 只走 scripts/ingest.py。

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
  mode?: "live" | "sample"; // live=跑批安装结果；sample=暖启动样板
  notice?: string;          // 人话提示横幅（可为空）
  needs_human_review?: boolean;
  formal_approval?: boolean;
  mvp_internal_only?: boolean;
  review_status?: {
    track_id?: string;
    track_status?: string;
    account_id?: string;
    needs_human_review?: boolean;
    formal_approval?: boolean;
    mvp_internal_only?: boolean;
    reason?: string;
  };
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
