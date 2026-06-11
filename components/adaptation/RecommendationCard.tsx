"use client";

// 内容决策卡：让老板一眼看懂「这条为什么适合我、连到我哪条记忆、怎么讲、成品是什么」。
//   头部   热点一句话 + 推荐等级 + 自检状态
//   连接链 戳的焦虑 → 跟生意的关系 → 接的价值（取引擎选定路径的字段，机械展示）
//   展开   几种讲法（桥梁路径）/ 成品草稿（标题+正文+平台标）
//   操作   复制 / 重新生成 / 编辑 / 打分（反馈闭环，已反馈有标记）
// 红线：绝不展示分数与内部术语；skip 不出内容，只给人话原因。

import { useState } from "react";

import FeedbackBar from "@/components/adaptation/FeedbackBar";
import {
  recommendationLabel,
  type AdaptationOutput,
  type BridgePath,
  type FeedbackPayload,
  type HotspotMeta,
} from "@/lib/adaptation-types";

type Props = {
  output: AdaptationOutput;
  meta: HotspotMeta;
  platformName?: string;
  featured?: boolean;          // 今日首推（hero 样式）
  busy?: boolean;              // 重新生成中
  regenerateNote?: string;     // 重新生成失败等人话提示
  feedbackDone?: boolean;      // 今天已对这条反馈过
  onCopy?: (text: string) => void;
  onRegenerate?: (hotspotId: string) => void;
  onFeedbackSubmit?: (hotspotId: string, payload: FeedbackPayload) => Promise<boolean> | boolean;
  defaultExpanded?: boolean;
};

const BADGE_TONE: Record<AdaptationOutput["recommendation"], string> = {
  strong_pick: "bg-[#E8F0DC] text-[#3E5C20]",
  maybe: "bg-[#F5EDDE] text-[#7A5520]",
  skip: "bg-[#EBE9E5] text-[#4A4A47]",
};

function chosenPath(o: AdaptationOutput): BridgePath | null {
  return o.bridge_paths.find((p) => p.path_id === o.chosen_path_id) ?? o.bridge_paths[0] ?? null;
}

function ChainChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 rounded-lg bg-[#FAF9F7] px-2.5 py-1.5">
      <span className="shrink-0 text-xs text-[#9B9892]">{label}</span>
      <span className="truncate text-xs text-[#4A4A47]" title={value}>
        {value}
      </span>
    </div>
  );
}

function PathRow({ path, chosen }: { path: BridgePath; chosen: boolean }) {
  const steps: { label: string; value: string }[] = [
    { label: "这事", value: path.phenomenon },
    { label: "戳的真问题", value: path.real_problem },
    { label: "跟你生意的关系", value: path.track_relation },
    { label: "怎么撑你产品", value: path.product_value_support },
    { label: "在这个平台怎么说", value: path.platform_expression },
  ];
  return (
    <div className={`rounded-lg border p-3 ${chosen ? "border-[#5C7A2E] bg-[#FBFDF7]" : "border-[#E8E6E1]"}`}>
      {chosen ? <div className="mb-1 text-xs font-medium text-[#5C7A2E]">推荐这个切入角度</div> : null}
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="text-sm leading-relaxed text-[#4A4A47]">
            <span className="text-[#9B9892]">{s.label}：</span>
            {s.value}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function RecommendationCard({
  output,
  meta,
  platformName,
  featured = false,
  busy = false,
  regenerateNote,
  feedbackDone = false,
  onCopy,
  onRegenerate,
  onFeedbackSubmit,
  defaultExpanded = false,
}: Props) {
  const [showPaths, setShowPaths] = useState<boolean>(defaultExpanded);
  const [showDraft, setShowDraft] = useState<boolean>(defaultExpanded || featured);
  const [copied, setCopied] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(feedbackDone);

  const isSkip = output.recommendation === "skip";
  const badge = recommendationLabel(output.recommendation);
  const cp = chosenPath(output);

  // ── skip 卡：告诉客户「为什么别蹭」，建立信任 ──
  if (isSkip) {
    const failedGate = output.external_terms_check === false;
    return (
      <div className="rounded-xl border border-[#E8E6E1] bg-[#F8F7F4] p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-[#4A4A47]">{meta.oneLiner}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${BADGE_TONE.skip}`}>
            {failedGate ? "自检拦下" : badge}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#6B6963]">
          <span className="text-[#9B9892]">为什么别蹭：</span>
          {output.skip_reason || meta.reason}
        </p>
        {onRegenerate && failedGate ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRegenerate(output.hotspot_id)}
            className="mt-2 rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#4A4A47] hover:bg-[#F0EDE5] disabled:opacity-50"
          >
            {busy ? "重新生成中…" : "下次跑批时重做"}
          </button>
        ) : null}
        {regenerateNote ? <p className="mt-2 text-xs text-[#A0411F]">{regenerateNote}</p> : null}
      </div>
    );
  }

  const content = output.content;
  const title = editTitle ?? content?.title ?? "";
  const body = editBody ?? content?.body_or_script ?? "";
  const edited = editTitle !== null || editBody !== null;

  function copyAll() {
    const textOut = [title, body].filter(Boolean).join("\n\n");
    onCopy?.(textOut);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${
        featured ? "border-2 border-[#5C7A2E]" : "border-[#E8E6E1]"
      } ${busy ? "opacity-70" : ""}`}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {featured ? <p className="mb-1 text-xs font-semibold text-[#5C7A2E]">★ 今日首推</p> : null}
          <p className="text-base font-semibold leading-snug text-[#1F1F1E]">{meta.oneLiner}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE_TONE[output.recommendation]}`}>{badge}</span>
          {done ? <span className="text-xs text-[#5C7A2E]">已反馈 ✓</span> : null}
        </div>
      </div>

      {/* 为什么适合我 */}
      <p className="mt-2 text-sm leading-relaxed text-[#4A4A47]">
        <span className="text-[#9B9892]">为什么推给你：</span>
        {meta.reason}
      </p>

      {/* 连接链：连到账号记忆的哪里（取自引擎选定路径，机械展示） */}
      {cp ? (
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          <ChainChip label="戳的焦虑" value={cp.real_problem} />
          <ChainChip label="接的价值" value={cp.product_value_support} />
        </div>
      ) : null}

      {/* 风险/自检状态行 */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {output.external_terms_check ? (
          <span className="text-[#5C7A2E]">✓ 自检通过：无禁区词{platformName ? ` · 形态按${platformName}` : ""}</span>
        ) : (
          <span className="text-[#7A5520]">⚠ 建议自己再过一遍用词</span>
        )}
        {output.recommendation === "maybe" ? (
          <span className="text-[#7A5520]">提醒：角度有点绕，发前自己挑一下讲法</span>
        ) : null}
        {edited ? <span className="text-[#7A5520]">已按你的修改保存（仅本机）</span> : null}
      </div>

      {/* 展开控制 */}
      <div className="mt-3 flex flex-wrap gap-3 border-t border-[#F0EDE5] pt-3">
        {output.bridge_paths.length > 0 ? (
          <button type="button" onClick={() => setShowPaths((v) => !v)} className="text-sm text-[#5C7A2E] hover:underline">
            {showPaths ? "收起讲法" : `看 ${output.bridge_paths.length} 种讲法`}
          </button>
        ) : null}
        {content ? (
          <button type="button" onClick={() => setShowDraft((v) => !v)} className="text-sm text-[#5C7A2E] hover:underline">
            {showDraft ? "收起草稿" : "看成品草稿"}
          </button>
        ) : null}
      </div>

      {/* 讲法（桥梁路径） */}
      {showPaths && output.bridge_paths.length > 0 ? (
        <div className="mt-3 space-y-2">
          {output.bridge_paths.map((p) => (
            <PathRow key={p.path_id} path={p} chosen={p.path_id === output.chosen_path_id} />
          ))}
        </div>
      ) : null}

      {/* 成品草稿 */}
      {showDraft && content ? (
        <div className="mt-3 rounded-lg border border-[#E8E6E1] bg-[#FAF9F7] p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#9B9892]">成品草稿{platformName ? ` · ${platformName}` : ""}</span>
            {!editing ? (
              <button
                type="button"
                onClick={copyAll}
                className="rounded-md bg-[#1F1F1E] px-3 py-1 text-xs text-white hover:bg-black"
              >
                {copied ? "已复制 ✓" : "一键复制"}
              </button>
            ) : null}
          </div>

          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-[#D9D6CF] px-3 py-2 text-sm font-medium focus:border-[#5C7A2E] focus:outline-none"
                placeholder="标题"
              />
              <textarea
                value={body}
                onChange={(e) => setEditBody(e.target.value)}
                rows={Math.min(14, Math.max(6, body.split("\n").length + 2))}
                className="w-full rounded-lg border border-[#D9D6CF] px-3 py-2 text-sm leading-relaxed focus:border-[#5C7A2E] focus:outline-none"
                placeholder="正文 / 脚本"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md bg-[#1F1F1E] px-3 py-1.5 text-sm text-white hover:bg-black"
                >
                  保存修改
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(null);
                    setEditBody(null);
                    setEditing(false);
                  }}
                  className="rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#4A4A47] hover:bg-[#F0EDE5]"
                >
                  还原
                </button>
              </div>
            </div>
          ) : (
            <>
              {title ? <p className="font-medium leading-snug text-[#1F1F1E]">{title}</p> : null}
              {body ? (
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[#4A4A47]">{body}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* 操作条 */}
      {!editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyAll}
            className="rounded-md bg-[#1F1F1E] px-3 py-1.5 text-sm text-white hover:bg-black"
          >
            {copied ? "已复制 ✓" : "复制"}
          </button>
          {onRegenerate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRegenerate(output.hotspot_id)}
              className="rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#4A4A47] hover:bg-[#F0EDE5] disabled:opacity-50"
            >
              {busy ? "重新生成中…" : "下次跑批时重做"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setShowDraft(true);
              setEditing(true);
            }}
            className="rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#4A4A47] hover:bg-[#F0EDE5]"
          >
            编辑
          </button>
          {onFeedbackSubmit && !done ? (
            <button
              type="button"
              onClick={() => setShowFeedback((v) => !v)}
              className="ml-auto rounded-md border border-dashed border-[#C9C6BF] px-3 py-1.5 text-sm text-[#6B6963] hover:bg-[#F0EDE5]"
            >
              打个分，明天更准
            </button>
          ) : null}
          {done ? <span className="ml-auto text-xs text-[#5C7A2E]">已收到你的反馈，明天据此调整 ✓</span> : null}
        </div>
      ) : null}
      {regenerateNote ? <p className="mt-2 text-xs text-[#A0411F]">{regenerateNote}</p> : null}

      {/* 反馈闭环 */}
      {showFeedback && !done && onFeedbackSubmit ? (
        <div className="mt-3">
          <FeedbackBar
            onSubmit={async (payload) => {
              const ok = await onFeedbackSubmit(output.hotspot_id, payload);
              if (ok) {
                setDone(true);
                setShowFeedback(false);
              }
              return ok;
            }}
            onSkip={() => setShowFeedback(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
