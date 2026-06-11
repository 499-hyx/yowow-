"use client";

import { useState } from "react";

type Props = {
  text: string;
  label?: string;
};

export default function CopyTextButton({ text, label = "复制脚本" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-md bg-[#1F1F1E] px-3 py-2 text-xs font-medium text-white hover:bg-black"
    >
      {copied ? "已复制" : label}
    </button>
  );
}
