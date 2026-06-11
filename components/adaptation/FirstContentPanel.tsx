"use client";

// 激活时刻：引导最后一屏当场给第一条真实内容。
// 三态：ready / no_pick_today（诚实不硬凑）/ pending_deploy（等接生成服务）。

import { useState } from "react";

import { type FirstContentResult } from "@/lib/adaptation-types";

type Props = {
  result: FirstContentResult;
  onCopy?: (text: string) => void;
  onEnterDaily?: () => void;
};

function EnterDailyButton({ onEnterDaily, primary }: { onEnterDaily?: () => void; primary?: boolean }) {
  if (!onEnterDaily) return null;
  return (
    <button
      type="button"
      onClick={onEnterDaily}
      className={
        primary
          ? "rounded-md bg-[#5C7A2E] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          : "rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#4A4A47] hover:bg-[#F0EDE5]"
      }
    >
      进入今日推荐 →
    </button>
  );
}

export default function FirstContentPanel({ result, onCopy, onEnterDaily }: Props) {
  const [copied, setCopied] = useState<boolean>(false);

  if (result.status === "pending_deploy") {
    return (
      <div className="rounded-xl border border-[#E8E6E1] bg-[#FAF9F7] p-4">
        <p className="text-sm leading-relaxed text-[#4A4A47]">
          {result.message || "正在为你的方向准备第一条内容…"}
        </p>
        <div className="mt-3">
          <EnterDailyButton onEnterDaily={onEnterDaily} primary />
        </div>
      </div>
    );
  }

  if (result.status === "no_pick_today" || !result.output || !result.output.content) {
    return (
      <div className="rounded-xl border border-dashed border-[#D9D6CF] bg-[#FAF9F7] p-4">
        <p className="text-sm leading-relaxed text-[#4A4A47]">
          {result.message || "今天没有特别合适的选题，明天再来看看（不硬凑，免得伤号）。"}
        </p>
        <div className="mt-3">
          <EnterDailyButton onEnterDaily={onEnterDaily} />
        </div>
      </div>
    );
  }

  const content = result.output.content;
  const copyText = [content.title, content.body_or_script].filter(Boolean).join("\n\n");

  return (
    <div className="rounded-xl border border-[#5C7A2E] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-[#5C7A2E]">
        {result.message || "这是替你写的第一条"}
      </p>
      {content.title ? (
        <p className="mt-2 font-medium leading-snug text-[#1F1F1E]">{content.title}</p>
      ) : null}
      {content.body_or_script ? (
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[#4A4A47]">
          {content.body_or_script}
        </p>
      ) : null}
      {result.output.external_terms_check ? (
        <p className="mt-2 text-xs text-[#9B9892]">已自检：没出现你的禁区词</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onCopy?.(copyText);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          className="rounded-md bg-[#1F1F1E] px-3 py-1.5 text-sm text-white hover:bg-black"
        >
          {copied ? "已复制 ✓" : "复制"}
        </button>
        <EnterDailyButton onEnterDaily={onEnterDaily} primary />
      </div>
    </div>
  );
}
