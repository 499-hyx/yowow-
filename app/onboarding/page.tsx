"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  QUESTION_SECTIONS,
  buildAccountJson,
  buildTrackDraftJson,
  prettyJson,
} from "@/lib/onboarding-questionnaire.mjs";

type Answers = Record<string, string>;

const initialAnswers: Answers = {
  platform_id: "douyin",
  positioning_id: "boss",
};

function fileNameFromAccount(accountId: string) {
  return `data/accounts/${accountId || "acct-new-account"}.json`;
}

function fileNameFromTrack(trackId: string) {
  return `config/tracks/${trackId || "new-track"}.json`;
}

export default function OnboardingPage() {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [copyState, setCopyState] = useState<{ label: string; status: "copied" | "failed" } | null>(null);

  const accountJson = useMemo(() => buildAccountJson(answers), [answers]);
  const trackJson = useMemo(() => buildTrackDraftJson(answers), [answers]);
  const accountText = useMemo(() => prettyJson(accountJson), [accountJson]);
  const trackText = useMemo(() => prettyJson(trackJson), [trackJson]);

  function update(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState({ label, status: "copied" });
    } catch {
      setCopyState({ label, status: "failed" });
    }
    window.setTimeout(() => setCopyState(null), 1800);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#7A7770]">新增账号</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">用问卷生成赛道记忆和账号记忆</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#6B6963]">
            这里不写数据库、不做审批、不建权限。填完问卷后，复制右侧 JSON 到本地文件，再跑 preflight 和每日跑批。
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-[#B8B5AD] bg-white px-4 py-2 text-sm font-medium text-[#343330] no-underline hover:bg-[#F3F1EC]"
        >
          回今日总览
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <section className="space-y-5">
          {QUESTION_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-lg border border-[#D8D3CB] bg-white p-5">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[#1F1F1E]">{section.title}</h2>
                <p className="mt-1 text-sm text-[#6B6963]">{section.description}</p>
              </div>

              <div className="space-y-4">
                {section.questions.map((question) => (
                  <label key={question.id} className="block">
                    <span className="text-sm font-medium text-[#343330]">{question.label}</span>
                    {question.type === "select" ? (
                      <select
                        value={answers[question.id] ?? ""}
                        onChange={(event) => update(question.id, event.target.value)}
                        className="mt-1 w-full rounded-md border border-[#D8D3CB] bg-[#FBFAF7] px-3 py-2 text-sm outline-none focus:border-[#5C7A2E]"
                      >
                        {(question.options ?? []).map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    ) : question.type === "textarea" ? (
                      <textarea
                        value={answers[question.id] ?? ""}
                        onChange={(event) => update(question.id, event.target.value)}
                        placeholder={question.placeholder}
                        className="mt-1 min-h-24 w-full rounded-md border border-[#D8D3CB] bg-[#FBFAF7] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#5C7A2E]"
                      />
                    ) : (
                      <input
                        value={answers[question.id] ?? ""}
                        onChange={(event) => update(question.id, event.target.value)}
                        placeholder={question.placeholder}
                        className="mt-1 w-full rounded-md border border-[#D8D3CB] bg-[#FBFAF7] px-3 py-2 text-sm outline-none focus:border-[#5C7A2E]"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-[#D8D3CB] bg-[#F8F4EE] p-5 text-sm leading-relaxed text-[#5B5852]">
            <div className="font-bold text-[#1F1F1E]">下一步</div>
            <p className="mt-2">
              先保存赛道 JSON，再保存账号 JSON。已有赛道时，只需要保存账号 JSON，并把账号里的 <code>track_id</code> 改成已有赛道 ID。
            </p>
            <p className="mt-2">
              文件名里的 <code>account_id</code> / <code>track_id</code> 保持英文短横线格式；中文名写在 <code>display_name</code> 和 <code>track_name</code>。
            </p>
            <pre className="mt-3 overflow-auto rounded-md bg-white p-3 text-xs text-[#343330]">
{`python3 scripts/status.py --date 2026-06-29 --preflight ${accountJson.account_id || "<account_id>"}`}
            </pre>
          </div>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
          <JsonPanel
            title="账号 JSON"
            subtitle={fileNameFromAccount(accountJson.account_id)}
            text={accountText}
            copyStatus={copyState?.label === "account" ? copyState.status : "idle"}
            onCopy={() => copy("account", accountText)}
          />
          <JsonPanel
            title="新赛道草稿 JSON"
            subtitle={fileNameFromTrack(trackJson.track_id)}
            text={trackText}
            copyStatus={copyState?.label === "track" ? copyState.status : "idle"}
            onCopy={() => copy("track", trackText)}
          />
        </aside>
      </div>
    </main>
  );
}

function JsonPanel({
  title,
  subtitle,
  text,
  copyStatus,
  onCopy,
}: {
  title: string;
  subtitle: string;
  text: string;
  copyStatus: "idle" | "copied" | "failed";
  onCopy: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#D8D3CB] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#EEEAE2] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#1F1F1E]">{title}</h2>
          <p className="mt-1 break-all text-xs text-[#7A7770]">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-live="polite"
          className="shrink-0 rounded-md bg-[#1F1F1E] px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
        >
          {copyStatus === "copied" ? "已复制" : copyStatus === "failed" ? "复制失败" : "复制"}
        </button>
      </div>
      {copyStatus === "failed" ? (
        <p className="border-b border-[#EEEAE2] px-4 py-2 text-xs text-[#A0411F]" role="status">
          复制失败，请手动选中文本复制。
        </p>
      ) : null}
      <pre className="max-h-[440px] overflow-auto p-4 text-xs leading-relaxed text-[#343330]">{text}</pre>
    </section>
  );
}
