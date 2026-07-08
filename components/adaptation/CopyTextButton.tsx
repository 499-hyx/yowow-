"use client";

import { useState } from "react";

type Props = {
  text: string;
  label?: string;
  className?: string;
};

export default function CopyTextButton({ text, label = "复制脚本", className }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-live="polite"
      className={className ?? "rounded-md bg-[#1F1F1E] px-3 py-2 text-xs font-medium text-white hover:bg-black"}
    >
      {status === "copied" ? "已复制" : status === "failed" ? "复制失败" : label}
    </button>
  );
}
