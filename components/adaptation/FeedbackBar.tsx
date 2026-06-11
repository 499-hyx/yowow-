"use client";

// 轻量反馈：五个 1-5 维度 + 「哪里牵强」开放框。
// 五维都点完才能提交（不再有零分占位）；提交中/失败给明确状态；「都挺好，跳过」直接关。

import { useState } from "react";

import {
  FEEDBACK_DIM_LABELS,
  type FeedbackDims,
  type FeedbackPayload,
} from "@/lib/adaptation-types";

type Props = {
  onSubmit?: (payload: FeedbackPayload) => Promise<boolean> | boolean;
  onSkip?: () => void;
};

export default function FeedbackBar({ onSubmit, onSkip }: Props) {
  const [dims, setDims] = useState<Partial<FeedbackDims>>({});
  const [note, setNote] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);

  const complete = FEEDBACK_DIM_LABELS.every(({ key }) => (dims[key] ?? 0) >= 1);

  async function submit() {
    if (!complete || sending) return;
    setSending(true);
    setFailed(false);
    try {
      const ok = await onSubmit?.({
        dims: dims as FeedbackDims,
        forced_or_unpublishable_note: note.trim() || undefined,
      });
      if (ok === false) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#E8E6E1] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[#1F1F1E]">这条怎么样？1 分不行，5 分很好</p>
        <button type="button" onClick={onSkip} className="text-sm text-[#6B6963] hover:underline">
          先不评了
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {FEEDBACK_DIM_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-sm text-[#4A4A47]">{label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDims((d) => ({ ...d, [key]: n }))}
                  aria-label={`${label} ${n} 分`}
                  className={`h-8 w-8 rounded-md text-sm transition-colors ${
                    (dims[key] ?? 0) === n
                      ? "bg-[#5C7A2E] font-medium text-white"
                      : (dims[key] ?? 0) > n
                        ? "bg-[#C9DCA8] text-[#3E5C20]"
                        : "bg-[#F0EDE5] text-[#6B6963] hover:bg-[#E8E4DA]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="哪里让你觉得牵强 / 不好发？（选填）"
        rows={2}
        className="mt-3 w-full rounded-lg border border-[#D9D6CF] px-3 py-2 text-sm focus:border-[#5C7A2E] focus:outline-none"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!complete || sending}
          onClick={() => void submit()}
          className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-40"
        >
          {sending ? "提交中…" : "提交，明天据此调整"}
        </button>
        {!complete ? <span className="text-xs text-[#9B9892]">五项都点一下才能交</span> : null}
        {failed ? <span className="text-xs text-[#A0411F]">没交上去，再试一次</span> : null}
      </div>
    </div>
  );
}
