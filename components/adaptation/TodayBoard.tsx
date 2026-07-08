"use client";

// 今日内容决策台：
//   顶部   账号条（记忆入口/换号/刷新）+ 今日统计条（可发/高匹配/待反馈/已跳过 + 生成时间 + 模式）
//   区域   ★今天优先发（首推 hero + 其余高匹配）/ 可以备选 / 不建议蹭（默认展开列表，给「为什么别蹭」）
//   状态   loading 骨架 / error 可重试 / 空板诚实文案 / 样板模式横幅
// heat 不进主排序（服务端已排好）；分数永不展示。

import { useState } from "react";

import RecommendationCard from "@/components/adaptation/RecommendationCard";
import {
  type AccountProfile,
  type AdaptationOutput,
  type BoardState,
  type DailyBoard,
  type FeedbackPayload,
  type HotspotMetaMap,
} from "@/lib/adaptation-types";

type Props = {
  account: AccountProfile;
  board: DailyBoard;
  meta: HotspotMetaMap;
  state?: BoardState;
  platformName?: string;
  notice?: string;
  mode?: "live" | "sample";
  generatedAt?: string;                 // HH:mm
  busyIds?: Record<string, boolean>;
  noteIds?: Record<string, string>;
  feedbackDoneIds?: Record<string, boolean>;
  memoryHref?: string;
  refreshing?: boolean;
  onRefresh?: () => void;               // 重新生成整板
  onSwitchAccount?: () => void;
  onRetry?: () => void;
  onCopy?: (text: string) => void;
  onRegenerate?: (hotspotId: string) => void;
  onFeedbackSubmit?: (hotspotId: string, payload: FeedbackPayload) => Promise<boolean>;
};

const EMPTY_META = { oneLiner: "", reason: "" };

function Loading() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[#6B6963]">正在为你的号匹配今天的热点、逐条判断接不接得住…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-[#F0EDE5]" />
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-[#E8C9BD] bg-[#FBEAE5] p-4">
      <p className="text-sm text-[#A0411F]">刚才没加载出来，可能是网络的事。</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-md bg-[#A0411F] px-3 py-1.5 text-sm text-white hover:opacity-90"
      >
        重试
      </button>
    </div>
  );
}

function Empty({ skippedCount, onRetry }: { skippedCount: number; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D9D6CF] bg-[#FAF9F7] p-6 text-center">
      <p className="text-sm font-medium text-[#4A4A47]">今天没挑到适合这个号的热点，硬推不如不推。</p>
      <p className="mt-1 text-sm text-[#6B6963]">
        {skippedCount > 0
          ? `今天的 ${skippedCount} 条大热点都跟你的号连不上（下面有逐条原因）。明天的热点不一样，明天再来。`
          : "明天的热点不一样，明天再来看看。"}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#4A4A47] hover:bg-[#F0EDE5]"
        >
          再判一次
        </button>
      ) : null}
    </div>
  );
}

export default function TodayBoard({
  account,
  board,
  meta,
  state = "ready",
  platformName,
  notice,
  mode,
  generatedAt,
  busyIds = {},
  noteIds = {},
  feedbackDoneIds = {},
  memoryHref,
  refreshing = false,
  onRefresh,
  onSwitchAccount,
  onRetry,
  onCopy,
  onRegenerate,
  onFeedbackSubmit,
}: Props) {
  const [showSkipped, setShowSkipped] = useState<boolean>(true);

  const strong = board.picks.filter((o) => o.recommendation === "strong_pick");
  const maybe = board.picks.filter((o) => o.recommendation === "maybe");
  const pendingFeedback = board.picks.filter((o) => !feedbackDoneIds[o.hotspot_id]).length;
  const today = new Date();

  function card(o: AdaptationOutput, featured = false) {
    return (
      <RecommendationCard
        key={o.hotspot_id}
        output={o}
        meta={meta[o.hotspot_id] ?? EMPTY_META}
        platformName={platformName}
        featured={featured}
        busy={busyIds[o.hotspot_id]}
        regenerateNote={noteIds[o.hotspot_id]}
        feedbackDone={feedbackDoneIds[o.hotspot_id]}
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        onFeedbackSubmit={onFeedbackSubmit}
      />
    );
  }

  return (
    <section className="space-y-4">
      {/* 账号条 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-[#6B6963]">
          <span className="font-semibold text-[#1F1F1E]">{account.display_name}</span>
          <span className="ml-2 text-xs text-[#9B9892]">
            {today.getMonth() + 1} 月 {today.getDate()} 日
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {onRefresh ? (
            <button
              type="button"
              disabled={refreshing || state === "loading"}
              onClick={onRefresh}
              className="text-[#6B6963] hover:underline disabled:opacity-50"
              title="重新匹配并生成今天的推荐"
            >
              {refreshing ? "重算中…" : "重算今天"}
            </button>
          ) : null}
          {memoryHref ? (
            <a href={memoryHref} className="text-[#6B6963] no-underline hover:underline">
              账号记忆
            </a>
          ) : null}
          {onSwitchAccount ? (
            <button type="button" onClick={onSwitchAccount} className="text-[#5C7A2E] hover:underline">
              换个号
            </button>
          ) : null}
        </div>
      </div>

      {/* 统计条 */}
      {state === "ready" || state === "no_pick_today" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#E8E6E1] bg-white px-4 py-2.5 text-sm">
          <span className="text-[#1F1F1E]">
            今日可发 <b>{board.picks.length}</b>
          </span>
          <span className="text-[#3E5C20]">
            优先发 <b>{strong.length}</b>
          </span>
          <span className="text-[#7A5520]">
            备选 <b>{maybe.length}</b>
          </span>
          <span className="text-[#6B6963]">
            不建议蹭 <b>{board.skipped.length}</b>
          </span>
          {pendingFeedback > 0 ? (
            <span className="text-[#7A5520]">待反馈 <b>{pendingFeedback}</b></span>
          ) : board.picks.length > 0 ? (
            <span className="text-[#5C7A2E]">反馈已齐 ✓</span>
          ) : null}
          <span className="ml-auto text-xs text-[#9B9892]">
            {mode === "sample" ? "示例数据" : mode === "live" ? "跑批结果" : ""}
            {generatedAt ? ` · 生成于 ${generatedAt}` : ""}
          </span>
        </div>
      ) : null}

      {notice && state !== "loading" && state !== "error" ? (
        <div className="rounded-lg bg-[#F5EDDE] px-3 py-2 text-sm leading-relaxed text-[#7A5520]">{notice}</div>
      ) : null}

      {state === "loading" ? (
        <Loading />
      ) : state === "error" ? (
        <ErrorState onRetry={onRetry} />
      ) : board.picks.length === 0 ? (
        <Empty skippedCount={board.skipped.length} onRetry={onRetry} />
      ) : (
        <div className="space-y-6">
          {strong.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-[#3E5C20]">今天优先发</h2>
                <span className="text-xs text-[#9B9892]">连接最自然，照着发就行</span>
              </div>
              {strong.map((o, i) => card(o, i === 0))}
            </div>
          ) : null}
          {maybe.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-[#7A5520]">可以备选</h2>
                <span className="text-xs text-[#9B9892]">接得上但角度要自己挑，发前过一眼</span>
              </div>
              {maybe.map((o) => card(o))}
            </div>
          ) : null}
        </div>
      )}

      {/* 不建议蹭：默认展开，让客户看到「为什么别蹭」，信任系统判断 */}
      {state !== "loading" && state !== "error" && board.skipped.length > 0 ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-[#6B6963]">不建议蹭</h2>
              <span className="text-xs text-[#9B9892]">
                这 {board.skipped.length} 条流量不小，但跟你的号连不上——硬蹭会伤号
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSkipped((v) => !v)}
              className="text-xs text-[#6B6963] hover:underline"
            >
              {showSkipped ? "收起" : "展开"}
            </button>
          </div>
          {showSkipped ? <div className="space-y-2">{board.skipped.map((o) => card(o))}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
