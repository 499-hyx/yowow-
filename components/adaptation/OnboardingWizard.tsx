"use client";

// 引导上手向导（多赛道版）：赛道 → 平台 → 人设 → 账号定位（逐题，预置赛道带预填）
// → 「我理解的你」确认（桥梁母题预览全部来自 config，绝非前端发明）→ 当场出第一条（三态）。
// 红线：全程零内部术语；自定义赛道没起草前诚实留空，不编。

import { useMemo, useState } from "react";

import FirstContentPanel from "@/components/adaptation/FirstContentPanel";
import {
  type FirstContentResult,
  type OnboardingAnswers,
  type PersonaOption,
  type PlatformOption,
  type TrackEcho,
  type TrackOption,
} from "@/lib/adaptation-types";

type Props = {
  tracks: TrackOption[];
  platforms: PlatformOption[];
  personas: PersonaOption[];
  draftEcho?: TrackEcho;          // 服务端起草结果（自定义赛道 + 已接生成服务时）
  firstContent?: FirstContentResult;
  submitting?: boolean;           // 已提交、首条生成中
  notice?: string;                // 服务端人话提示
  onSubmit?: (a: OnboardingAnswers) => void;
  onCopy?: (text: string) => void;
  onEnterDaily?: () => void;
};

const GOAL_OPTIONS = ["直接带货", "建立信任", "招商加盟", "引流获客", "品牌心智", "私域沉淀", "留资询盘"];
const PROOF_OPTIONS = ["工厂实拍", "资质证书", "客户案例", "数据效果", "真人测评"];

const splitList = (s: string): string[] =>
  s.split(/[\n,，、]/).map((x) => x.trim()).filter(Boolean);

function Chip({ active, label, sub, onClick }: { active: boolean; label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-[#5C7A2E] bg-[#E8F0DC] text-[#3E5C20]"
          : "border-[#D9D6CF] text-[#4A4A47] hover:bg-[#F0EDE5]"
      }`}
    >
      {label}
      {sub ? <span className="ml-1 text-xs text-[#9B9892]">{sub}</span> : null}
    </button>
  );
}

type TextStepId = "business" | "audience" | "product_value";

export default function OnboardingWizard({
  tracks,
  platforms,
  personas,
  draftEcho,
  firstContent,
  submitting = false,
  notice,
  onSubmit,
  onCopy,
  onEnterDaily,
}: Props) {
  // ── 选择态 ──
  const [trackId, setTrackId] = useState<string>("");        // 预置 id 或 "custom"
  const [trackCustom, setTrackCustom] = useState<string>("");
  const [platformId, setPlatformId] = useState<string>("");
  const [positioningId, setPositioningId] = useState<string>("");
  const [text, setText] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<string[]>([]);
  const [proofs, setProofs] = useState<string[]>([]);
  const [helpNote, setHelpNote] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<number>(0);

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.track_id === trackId) ?? null,
    [tracks, trackId],
  );
  const isCustom = trackId === "custom";

  // ── 步骤定义 ──
  type Step =
    | { id: "track" }
    | { id: "platform" }
    | { id: "persona" }
    | { id: TextStepId; ask: string; placeholder: string; required?: boolean }
    | { id: "anxiety"; ask: string }
    | { id: "goal" }
    | { id: "proof" }
    | { id: "style"; ask: string }
    | { id: "confirm" }
    | { id: "activate" };

  const steps: Step[] = [
    { id: "track" },
    { id: "platform" },
    { id: "persona" },
    { id: "business", ask: "你主要卖什么产品或服务？", placeholder: "用一句话说说就行", required: true },
    { id: "audience", ask: "谁会买它？", placeholder: "比如：30 岁上下、注重形象的上班族" },
    { id: "product_value", ask: "你的东西最大的好，用一句话怎么说？", placeholder: "客户最认的那一点" },
    { id: "anxiety", ask: "你的客户平时最焦虑或最在意什么？" },
    { id: "goal" },
    { id: "proof" },
    { id: "style", ask: "内容风格和禁区（选填）" },
    { id: "confirm" },
    { id: "activate" },
  ];
  const totalShown = steps.length - 1; // activate 不计入进度
  const current = steps[step];

  // 预填：选了预置赛道后，把博士/老板配置里的定位信息填进来（用户可改）
  function prefillFromTrack(t: TrackOption) {
    setText((prev) => ({
      ...prev,
      business: prev.business || t.prefill.business || "",
      audience: prev.audience || t.prefill.audience || "",
      product_value: prev.product_value || t.prefill.product_value || "",
      anxiety: prev.anxiety || (t.prefill.anxiety_anchors ?? []).join("\n"),
    }));
    setGoals((g) => (g.length ? g : t.prefill.commercial_goal ?? []));
    setProofs((p) => (p.length ? p : t.prefill.proof_assets ?? []));
  }

  function help(id: string) {
    if (selectedTrack) {
      const fill: Record<string, string | undefined> = {
        business: selectedTrack.prefill.business,
        audience: selectedTrack.prefill.audience,
        product_value: selectedTrack.prefill.product_value,
        anxiety: (selectedTrack.prefill.anxiety_anchors ?? []).join("\n"),
      };
      if (fill[id]) {
        setText((prev) => ({ ...prev, [id]: fill[id] as string }));
        return;
      }
    }
    setHelpNote((h) => ({ ...h, [id]: true }));
  }

  function buildAnswers(): OnboardingAnswers {
    return {
      track_id: trackId || undefined,
      track_custom: isCustom ? trackCustom.trim() || undefined : undefined,
      business: (text.business ?? "").trim() || (isCustom ? trackCustom.trim() : undefined) || undefined,
      audience: (text.audience ?? "").trim() || undefined,
      product_value: (text.product_value ?? "").trim() || undefined,
      anxiety_anchors: splitList(text.anxiety ?? ""),
      commercial_goal: goals,
      proof_assets: proofs,
      content_style: (text.style ?? "").trim() || undefined,
      extra_forbidden_terms: splitList(text.forbidden ?? ""),
      platform_id: platformId || undefined,
      positioning_id: positioningId || undefined,
      help_requested: helpNote,
    };
  }

  // ── 每步能否继续 ──
  function canNext(): boolean {
    if (current.id === "track") return trackId !== "" && (!isCustom || trackCustom.trim() !== "");
    if (current.id === "platform") return platformId !== "";
    if (current.id === "persona") return positioningId !== "";
    if (current.id === "business") return (text.business ?? "").trim() !== "" || isCustom;
    return true;
  }

  const platformName = platforms.find((p) => p.platform_id === platformId)?.platform_name ?? "";
  const personaName = personas.find((p) => p.positioning_id === positioningId)?.positioning_name ?? "";

  // ── 各步渲染 ──
  function renderTrack() {
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">你做的是哪一行？</p>
        <p className="mt-1 text-sm text-[#6B6963]">选一个最接近的，后面都能改。</p>
        <div className="mt-4 space-y-2">
          {tracks.map((t) => (
            <button
              key={t.track_id}
              type="button"
              onClick={() => {
                setTrackId(t.track_id);
                prefillFromTrack(t);
              }}
              className={`block w-full rounded-xl border p-3 text-left transition-colors ${
                trackId === t.track_id
                  ? "border-[#5C7A2E] bg-[#F4F8EC]"
                  : "border-[#E8E6E1] bg-white hover:border-[#C9C6BF]"
              }`}
            >
              <p className="font-medium text-[#1F1F1E]">{t.track_name}</p>
              {t.tagline ? <p className="mt-0.5 text-xs text-[#6B6963]">{t.tagline}</p> : null}
              {t.bridge_preview.length > 0 ? (
                <p className="mt-1.5 text-xs text-[#5C7A2E]">
                  常用角度：{t.bridge_preview.slice(0, 3).join(" · ")}
                </p>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTrackId("custom")}
            className={`block w-full rounded-xl border p-3 text-left transition-colors ${
              isCustom ? "border-[#5C7A2E] bg-[#F4F8EC]" : "border-dashed border-[#D9D6CF] bg-[#FAF9F7] hover:border-[#C9C6BF]"
            }`}
          >
            <p className="font-medium text-[#1F1F1E]">都不是，我做的是别的</p>
            <p className="mt-0.5 text-xs text-[#6B6963]">一句话告诉我你卖什么，我来配</p>
          </button>
          {isCustom ? (
            <input
              type="text"
              autoFocus
              value={trackCustom}
              onChange={(e) => setTrackCustom(e.target.value)}
              placeholder="比如：做办公椅的工厂，主打人体工学"
              className="w-full rounded-lg border border-[#D9D6CF] px-3 py-2.5 text-sm focus:border-[#5C7A2E] focus:outline-none"
            />
          ) : null}
        </div>
      </div>
    );
  }

  function renderPlatform() {
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">先主攻哪个平台？</p>
        <p className="mt-1 text-sm text-[#6B6963]">内容形式、标题、节奏都会按这个平台出。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {platforms.map((p) => (
            <Chip
              key={p.platform_id}
              active={platformId === p.platform_id}
              label={p.platform_name}
              onClick={() => setPlatformId(p.platform_id)}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderPersona() {
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">用什么人设出镜？</p>
        <p className="mt-1 text-sm text-[#6B6963]">决定内容的口吻和可信度来源。</p>
        <div className="mt-4 space-y-2">
          {personas.map((p) => (
            <button
              key={p.positioning_id}
              type="button"
              onClick={() => setPositioningId(p.positioning_id)}
              className={`block w-full rounded-xl border p-3 text-left transition-colors ${
                positioningId === p.positioning_id
                  ? "border-[#5C7A2E] bg-[#F4F8EC]"
                  : "border-[#E8E6E1] bg-white hover:border-[#C9C6BF]"
              }`}
            >
              <p className="font-medium text-[#1F1F1E]">{p.positioning_name}</p>
              {p.voice ? <p className="mt-0.5 text-xs text-[#6B6963]">{p.voice}</p> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderText(id: TextStepId, ask: string, placeholder: string) {
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">{ask}</p>
        <input
          type="text"
          value={text[id] ?? ""}
          onChange={(e) => setText((prev) => ({ ...prev, [id]: e.target.value }))}
          placeholder={placeholder}
          className="mt-3 w-full rounded-lg border border-[#D9D6CF] px-3 py-2.5 text-sm focus:border-[#5C7A2E] focus:outline-none"
        />
        <button type="button" onClick={() => help(id)} className="mt-3 text-sm text-[#5C7A2E] hover:underline">
          我不确定，帮我想
        </button>
        {helpNote[id] ? (
          <p className="mt-1 text-xs text-[#6B6963]">没事，先凭感觉写两句，确认页都能改；我也会按你前面的回答替你补。</p>
        ) : null}
      </div>
    );
  }

  function renderAnxiety(ask: string) {
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">{ask}</p>
        <p className="mt-1 text-sm text-[#6B6963]">这是选热点的重要依据：内容要戳他们真正在意的事。</p>
        <textarea
          value={text.anxiety ?? ""}
          onChange={(e) => setText((prev) => ({ ...prev, anxiety: e.target.value }))}
          placeholder={"一行一个，比如：\n怕买贵了踩雷\n怕用着不合适"}
          rows={4}
          className="mt-3 w-full rounded-lg border border-[#D9D6CF] px-3 py-2.5 text-sm focus:border-[#5C7A2E] focus:outline-none"
        />
        <button type="button" onClick={() => help("anxiety")} className="mt-3 text-sm text-[#5C7A2E] hover:underline">
          我不确定，帮我想
        </button>
        {helpNote.anxiety ? (
          <p className="mt-1 text-xs text-[#6B6963]">先写你最常被客户问到的事就行，后面随时能补。</p>
        ) : null}
      </div>
    );
  }

  function renderMulti(
    ask: string,
    sub: string,
    options: string[],
    value: string[],
    setValue: (v: string[]) => void,
  ) {
    const all = Array.from(new Set([...options, ...value]));
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">{ask}</p>
        <p className="mt-1 text-sm text-[#6B6963]">{sub}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {all.map((opt) => (
            <Chip
              key={opt}
              active={value.includes(opt)}
              label={opt}
              onClick={() =>
                setValue(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt])
              }
            />
          ))}
        </div>
      </div>
    );
  }

  function renderStyle() {
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">内容风格和禁区（选填）</p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1 text-sm text-[#6B6963]">想要的风格，比如「实在直给」「亲切像聊天」</p>
            <input
              type="text"
              value={text.style ?? ""}
              onChange={(e) => setText((prev) => ({ ...prev, style: e.target.value }))}
              placeholder="不填就按你选的人设口吻来"
              className="w-full rounded-lg border border-[#D9D6CF] px-3 py-2.5 text-sm focus:border-[#5C7A2E] focus:outline-none"
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-[#6B6963]">绝不想出现的词或话题（一行一个）</p>
            <textarea
              value={text.forbidden ?? ""}
              onChange={(e) => setText((prev) => ({ ...prev, forbidden: e.target.value }))}
              placeholder={"比如：\n最低价\n同行名字"}
              rows={3}
              className="w-full rounded-lg border border-[#D9D6CF] px-3 py-2.5 text-sm focus:border-[#5C7A2E] focus:outline-none"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderConfirm() {
    // 桥梁母题预览：预置赛道来自 config（博士/老板写）；自定义赛道在没起草前诚实留空。
    const vocab = selectedTrack?.bridge_preview ?? draftEcho?.external_vocab ?? [];
    const forbidden = Array.from(
      new Set([...(selectedTrack?.forbidden_preview ?? []), ...splitList(text.forbidden ?? "")]),
    );
    return (
      <div>
        <p className="text-lg font-medium text-[#1F1F1E]">我理解的你，对吗？</p>
        <div className="mt-4 space-y-3 rounded-xl border border-[#E8E6E1] bg-white p-4 text-sm text-[#4A4A47]">
          <p>
            <span className="text-[#9B9892]">你的生意：</span>
            {(text.business ?? "").trim() || trackCustom || selectedTrack?.track_name || "—"}
          </p>
          <p>
            <span className="text-[#9B9892]">卖给：</span>
            {(text.audience ?? "").trim() || "—"}
          </p>
          <p>
            <span className="text-[#9B9892]">阵地：</span>
            {platformName} · {personaName}
          </p>
          {goals.length > 0 ? (
            <p>
              <span className="text-[#9B9892]">想达成：</span>
              {goals.join("、")}
            </p>
          ) : null}
        </div>

        <div className="mt-3 rounded-xl border border-[#E8E6E1] bg-white p-4">
          <p className="text-sm font-medium text-[#1F1F1E]">替你讲内容时，我会常用这些角度</p>
          {vocab.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {vocab.map((w) => (
                <span key={w} className="rounded-full bg-[#E8F0DC] px-3 py-1 text-sm text-[#3E5C20]">
                  {w}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#6B6963]">
              你的方向比较新，专属角度会在生成第一条时一起起草给你确认。
            </p>
          )}
          {forbidden.length > 0 ? (
            <>
              <p className="mt-3 text-sm font-medium text-[#1F1F1E]">这些词绝不会出现在你的文案里</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {forbidden.map((w) => (
                  <span key={w} className="rounded-full bg-[#EBE9E5] px-3 py-1 text-sm text-[#6B6963]">
                    {w}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  function renderActivate() {
    const echoVocab = (draftEcho?.external_vocab ?? []).filter(
      (w) => !(selectedTrack?.bridge_preview ?? []).includes(w),
    );
    return (
      <div className="space-y-3">
        {submitting && !firstContent ? (
          <div className="rounded-xl border border-[#E8E6E1] bg-white p-5">
            <p className="text-sm font-medium text-[#1F1F1E]">正在替你写第一条…</p>
            <p className="mt-1 text-sm text-[#6B6963]">挑今天最适合你的热点，按{platformName || "你选的平台"}的样子写好。</p>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-[#F0EDE5]" />
              <div className="h-3 w-full animate-pulse rounded bg-[#F0EDE5]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[#F0EDE5]" />
            </div>
          </div>
        ) : (
          <>
            {notice ? (
              <div className="rounded-lg bg-[#F5EDDE] px-3 py-2 text-sm text-[#7A5520]">{notice}</div>
            ) : null}
            {echoVocab.length > 0 ? (
              <div className="rounded-xl border border-[#E8E6E1] bg-white p-4">
                <p className="text-sm font-medium text-[#1F1F1E]">替你起草的内容角度</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {echoVocab.map((w) => (
                    <span key={w} className="rounded-full bg-[#E8F0DC] px-3 py-1 text-sm text-[#3E5C20]">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <FirstContentPanel
              result={firstContent ?? { status: "pending_deploy", message: "正在为你准备第一条…" }}
              onCopy={onCopy}
              onEnterDaily={onEnterDaily}
            />
          </>
        )}
      </div>
    );
  }

  function renderStep() {
    switch (current.id) {
      case "track":
        return renderTrack();
      case "platform":
        return renderPlatform();
      case "persona":
        return renderPersona();
      case "business":
      case "audience":
      case "product_value":
        return renderText(current.id, current.ask, current.placeholder);
      case "anxiety":
        return renderAnxiety(current.ask);
      case "goal":
        return renderMulti("你发内容，最想达成什么？", "可以多选。", GOAL_OPTIONS, goals, setGoals);
      case "proof":
        return renderMulti("你能拿出什么让人信你？", "可以多选，没有也没关系。", PROOF_OPTIONS, proofs, setProofs);
      case "style":
        return renderStyle();
      case "confirm":
        return renderConfirm();
      case "activate":
        return renderActivate();
    }
  }

  const isActivate = current.id === "activate";
  const isConfirm = current.id === "confirm";

  return (
    <section className="mx-auto max-w-xl space-y-5">
      {!isActivate ? (
        <div className="h-1 w-full rounded bg-[#EFEce5]">
          <div
            className="h-1 rounded bg-[#5C7A2E] transition-all"
            style={{ width: `${Math.round(((step + 1) / totalShown) * 100)}%` }}
          />
        </div>
      ) : null}

      {renderStep()}

      {!isActivate ? (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-md px-3 py-2 text-sm text-[#6B6963] disabled:opacity-40 hover:underline"
          >
            上一步
          </button>
          <span className="text-xs text-[#9B9892]">{step + 1} / {totalShown}</span>
          {isConfirm ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                onSubmit?.(buildAnswers());
                setStep((s) => s + 1);
              }}
              className="rounded-md bg-[#5C7A2E] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              对，生成第一条
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-40"
            >
              下一步
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
