"use client";

import { useState } from "react";

type ScoreKey = "can_publish" | "bridge_natural" | "angle_fit";

const SCORE_FIELDS: { key: ScoreKey; label: string }[] = [
  { key: "can_publish", label: "这条能发吗" },
  { key: "bridge_natural", label: "连接自然吗" },
  { key: "angle_fit", label: "角度对吗" },
];

type Props = {
  accountId: string;
  date: string | null;
  outputRef: {
    hotspot_id: string;
    track_id: string;
    platform_id: string;
    positioning_id: string;
  };
};

export default function FeedbackV1Box({ accountId, date, outputRef }: Props) {
  const [scores, setScores] = useState<Partial<Record<ScoreKey, number>>>({});
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const complete = SCORE_FIELDS.every(({ key }) => typeof scores[key] === "number");

  async function submit() {
    if (!complete || !date || state === "saving") return;
    setState("saving");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          date,
          hotspot_id: outputRef.hotspot_id,
          output_ref: outputRef,
          payload: {
            can_publish: scores.can_publish,
            bridge_natural: scores.bridge_natural,
            angle_fit: scores.angle_fit,
            note: note.trim() || undefined,
          },
        }),
      });
      setState(response.ok ? "saved" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="mt-3 rounded-md border border-[#E8E6E1] bg-white/75 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-[#8A877F]">反馈</div>
          <p className="text-xs text-[#6B6963]">只保存评分文件，不改变今天的推荐。</p>
        </div>
        {state === "saved" ? <span className="text-xs text-[#5C7A2E]">已保存到反馈收件箱</span> : null}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {SCORE_FIELDS.map(({ key, label }) => (
          <div key={key} className="rounded-md bg-[#FAF9F7] p-2">
            <div className="text-xs text-[#4A4A47]">{label}</div>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setScores((current) => ({ ...current, [key]: score }))}
                  className={`h-7 w-7 rounded text-xs ${
                    scores[key] === score
                      ? "bg-[#1F1F1E] font-medium text-white"
                      : "bg-white text-[#6B6963] hover:bg-[#F0EDE5]"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="备注，哪里好发或哪里别扭（选填）"
        className="mt-3 w-full rounded-md border border-[#D9D6CF] bg-white px-3 py-2 text-sm focus:border-[#5C7A2E] focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!complete || !date || state === "saving" || state === "saved"}
          onClick={() => void submit()}
          className="rounded-md bg-[#1F1F1E] px-3 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-40"
        >
          {state === "saving" ? "保存中" : state === "saved" ? "已保存" : "保存反馈"}
        </button>
        {!complete ? <span className="text-xs text-[#9B9892]">三项都打分后才能保存</span> : null}
        {!date ? <span className="text-xs text-[#A0411F]">缺少日期，不能保存</span> : null}
        {state === "failed" ? <span className="text-xs text-[#A0411F]">保存失败，请重试</span> : null}
      </div>
    </div>
  );
}
