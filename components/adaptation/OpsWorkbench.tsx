"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import CopyTextButton from "@/components/adaptation/CopyTextButton";

type OpsAccount = {
  account_id: string;
  display_name?: string;
  track_id?: string;
  track_name?: string;
  status?: string;
};

type PromptBundle = {
  broad: string;
  broadPrompts?: Array<{
    id: string;
    title: string;
    text: string;
  }>;
  search: string;
  account?: {
    account_id?: string;
    display_name?: string;
    track_id?: string;
    status?: string;
  };
  track?: { track_id?: string; track_name?: string };
};

type PromptFile = {
  name: string;
  hotspot_id: string;
  relativePath: string;
  content: string;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
  output?: string;
  relativePath?: string;
  count?: number;
  files?: Array<{ relativePath: string }>;
  prompts?: PromptBundle | PromptFile[];
};

type StepKey = "setup" | "broad" | "track" | "matchPrompt" | "matchReply" | "generatePrompt" | "generateReply" | "install";

type Props = {
  accounts: OpsAccount[];
  initialDate: string;
  initialPrompts: PromptBundle | null;
};

type TaskStatus = "done" | "active" | "pending";

function compactError(result: ApiResult) {
  return result.error || result.output || "操作失败。";
}

function humanizeOpsMessage(message: string) {
  if (message.includes("没有任何热点池文件") || message.includes("请先写入热点")) {
    return "这一天还没有热点池。先回到第 1 步保存全网热点或赛道热点，再生成提示词。";
  }
  if (
    message.includes("当前账号还没有生成这些") ||
    message.includes("回贴里的 hotspot_id 不在") ||
    message.includes("track_id 不一致") ||
    message.includes("platform_id 不一致") ||
    message.includes("positioning_id 不一致")
  ) {
    return "这批 GPT 回贴和当前选择的账号不匹配。请切回生成这批提示词时的账号，再保存或安装。";
  }
  if (message.includes("热点文件应为 JSON 数组") || message.includes("hotspot_id")) {
    return "粘贴内容格式不对。请确认是 JSON，并且每条都有 hotspot_id。";
  }
  if (message.includes("title")) {
    return "粘贴内容格式不对。请确认是 JSON 数组，并且每条热点都有 title。";
  }
  return message;
}

function promptsToClipboard(prompts: PromptFile[]) {
  if (!prompts.length) return "暂无提示词";
  const stage = prompts[0]?.name.startsWith("generate-") ? "分析+内容生成" : "热点判断";
  const tasks = prompts
    .map((prompt, index) => {
      return [
        `<TASK ${index + 1} hotspot_id="${prompt.hotspot_id}">`,
        prompt.content,
        "</TASK>",
      ].join("\n");
    })
    .join("\n\n");
  return [
    `你将收到 ${prompts.length} 条${stage}任务。`,
    "最终只输出一个 JSON 数组，不要 Markdown，不要解释，不要多余文字。",
    "数组里的每个对象必须带 hotspot_id，并且字段要符合每条任务里的输出合同。",
    "不要输出文件路径；页面会按 hotspot_id 自动保存。",
    "",
    tasks,
  ].join("\n");
}

async function postJson<T extends ApiResult>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  if (!response.ok || data.ok === false) {
    throw new Error(compactError(data));
  }
  return data;
}

function statusOf(done: boolean, active: boolean): TaskStatus {
  if (done) return "done";
  return active ? "active" : "pending";
}

function taskTone(status: TaskStatus) {
  if (status === "done") return "border-[#A9C682] bg-[#F2F8E9] text-[#36591C]";
  if (status === "active") return "border-[#D49A42] bg-[#FFF3D8] text-[#7A4B12]";
  return "border-[#E3E0D8] bg-[#F8F7F4] text-[#7A7770]";
}

function TaskChecklist({
  hotspotReady,
  matchGenerated,
  matchSaved,
  generateGenerated,
  generateSaved,
  installed,
}: {
  hotspotReady: boolean;
  matchGenerated: boolean;
  matchSaved: boolean;
  generateGenerated: boolean;
  generateSaved: boolean;
  installed: boolean;
}) {
  const tasks = [
    {
      label: "准备今天的热点",
      hint: "复制热点提示词给 GPT，再把热点结果粘回来。",
      status: statusOf(hotspotReady, !hotspotReady),
    },
    {
      label: "复制判断提示词给 GPT",
      hint: "让 GPT 判断哪些热点能发、哪些别蹭。",
      status: statusOf(matchGenerated, hotspotReady && !matchGenerated),
    },
    {
      label: "粘回 GPT 判断结果",
      hint: "把 GPT 返回的判断结果粘到页面右侧。",
      status: statusOf(matchSaved, matchGenerated && !matchSaved),
    },
    {
      label: "复制内容提示词给 GPT",
      hint: "只给通过判断的热点生成内容草稿。",
      status: statusOf(generateGenerated, matchSaved && !generateGenerated),
    },
    {
      label: "粘回 GPT 内容结果",
      hint: "把 GPT 写好的内容结果粘回来。",
      status: statusOf(generateSaved, generateGenerated && !generateSaved),
    },
    {
      label: "安装到今日页面",
      hint: "系统校验通过后，结果页才会更新。",
      status: statusOf(installed, generateSaved && !installed),
    },
  ];
  const next = tasks.find((task) => task.status !== "done");
  const nextText = next ? `下一步：${next.label === "准备今天的热点" ? "先准备今天的热点" : next.label}` : "下一步：打开结果页检查今日推荐";

  return (
    <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1E]">今日任务清单</h2>
          <p className="mt-1 text-sm text-[#6B6963]">照顺序做，完成一步再看下一步。不需要记文件夹。</p>
        </div>
        <div className="rounded-full bg-[#1F1F1E] px-3 py-1.5 text-sm font-medium text-white">{nextText}</div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task, index) => (
          <div key={task.label} className={`rounded-md border px-3 py-3 ${taskTone(task.status)}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold">
                {index + 1}. {task.label}
              </div>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">
                {task.status === "done" ? "完成" : task.status === "active" ? "进行中" : "待办"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed opacity-85">{task.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TechPath({ pathText }: { pathText: string }) {
  return (
    <details className="mt-2 rounded-md border border-[#E8E6E1] bg-[#FBFAF7] px-3 py-2 text-xs text-[#6B6963]">
      <summary className="cursor-pointer font-medium text-[#4A4A47]">查看技术路径</summary>
      <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-[#343330]">{pathText}</code>
    </details>
  );
}

function StepNotice({ message }: { message?: string }) {
  if (!message) return null;
  const isError = /失败|没有|不对|缺少|错误/.test(message);
  return (
    <div
      className={`mt-3 rounded-md border px-3 py-2 text-sm leading-relaxed ${
        isError ? "border-[#D49A42] bg-[#FFF3D8] text-[#7A4B12]" : "border-[#A9C682] bg-[#F2F8E9] text-[#36591C]"
      }`}
      aria-live="polite"
    >
      {message}
    </div>
  );
}

function PasteBox({
  label,
  value,
  onChange,
  placeholder,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helper: string;
}) {
  const textareaId = useId();

  async function readFile(file: File | undefined) {
    if (!file) return;
    onChange(await file.text());
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={textareaId} className="text-sm font-bold text-[#343330]">
          {label}
        </label>
        <label className="cursor-pointer rounded-md border border-[#B8B5AD] bg-white px-3 py-1.5 text-xs font-medium text-[#343330] hover:bg-[#F3F1EC]">
          从文件导入
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void readFile(event.currentTarget.files?.[0])}
          />
        </label>
      </div>
      <p className="mb-2 text-xs leading-relaxed text-[#7A7770]">{helper}</p>
      <textarea
        id={textareaId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-40 w-full resize-y rounded-md border border-[#D8D3CB] bg-white p-3 font-mono text-xs leading-relaxed text-[#343330] outline-none focus:border-[#7A9350]"
      />
    </div>
  );
}

function PromptPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#1F1F1E]">{title}</h3>
        <CopyTextButton text={text} label="复制提示词" />
      </div>
      <textarea
        readOnly
        value={text}
        className="mt-3 h-44 w-full resize-y rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3 font-mono text-xs leading-relaxed text-[#343330]"
      />
    </section>
  );
}

function PromptList({ title, prompts }: { title: string; prompts: PromptFile[] }) {
  const allText = useMemo(() => promptsToClipboard(prompts), [prompts]);
  return (
    <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#1F1F1E]">
          {title} <span className="font-normal text-[#7A7770]">({prompts.length} 条)</span>
        </h3>
        <CopyTextButton text={allText || "暂无提示词"} label="复制全部给 GPT" />
      </div>
      {prompts.length ? (
        <div className="mt-3 space-y-2">
          {prompts.map((prompt) => (
            <details key={prompt.relativePath} className="rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
              <summary className="cursor-pointer text-sm font-medium text-[#343330]">热点 {prompt.hotspot_id}</summary>
              <div className="mt-3 flex justify-end">
                <CopyTextButton text={prompt.content} label="复制这一条给 GPT" />
              </div>
              <TechPath pathText={prompt.relativePath} />
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-relaxed text-[#343330]">
                {prompt.content}
              </pre>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-[#D8D3CB] bg-[#FAF9F7] p-3 text-sm text-[#6B6963]">
          还没生成。点上面的按钮后，这里会出现可复制的提示词。
        </p>
      )}
    </section>
  );
}

export default function OpsWorkbench({ accounts, initialDate, initialPrompts }: Props) {
  const [date, setDate] = useState(initialDate);
  const [accountId, setAccountId] = useState(accounts[0]?.account_id ?? "");
  const [prompts, setPrompts] = useState<PromptBundle | null>(initialPrompts);
  const [broadPool, setBroadPool] = useState("");
  const [trackPool, setTrackPool] = useState("");
  const [matchReplies, setMatchReplies] = useState("");
  const [generateReplies, setGenerateReplies] = useState("");
  const [matchPrompts, setMatchPrompts] = useState<PromptFile[]>([]);
  const [generatePrompts, setGeneratePrompts] = useState<PromptFile[]>([]);
  const [broadSaved, setBroadSaved] = useState(false);
  const [trackSaved, setTrackSaved] = useState(false);
  const [matchSaved, setMatchSaved] = useState(false);
  const [generateSaved, setGenerateSaved] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [notice, setNotice] = useState("选择日期和账号后，从上到下跑。");
  const [stepNotice, setStepNotice] = useState<Partial<Record<StepKey, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const account = accounts.find((item) => item.account_id === accountId);
  const trackId = prompts?.track?.track_id ?? account?.track_id ?? "";
  const broadPromptPanels = prompts?.broadPrompts?.length
    ? prompts.broadPrompts
    : prompts
      ? [{ id: "platform-native", title: "平台原生全网热点", text: prompts.broad }]
      : [];
  const resultHref = accountId ? `/account/${accountId}?date=${date}` : "/accounts";
  const hotspotReady = broadSaved && trackSaved;
  const matchGenerated = matchPrompts.length > 0;
  const generateGenerated = generatePrompts.length > 0;

  function resetRunState() {
    setMatchPrompts([]);
    setGeneratePrompts([]);
    setBroadSaved(false);
    setTrackSaved(false);
    setMatchSaved(false);
    setGenerateSaved(false);
    setInstalled(false);
    setStepNotice({});
  }

  async function run(label: string, action: () => Promise<string>, step?: StepKey) {
    setBusy(label);
    setNotice(`${label}中...`);
    if (step) setStepNotice((current) => ({ ...current, [step]: `${label}中...` }));
    try {
      const message = await action();
      setNotice(step ? `已完成：${label}。详情见对应步骤。` : message);
      if (step) setStepNotice((current) => ({ ...current, [step]: message }));
    } catch (error) {
      const raw = error instanceof Error ? error.message : `${label}失败。`;
      const message = humanizeOpsMessage(raw);
      setNotice(step ? `${label}失败。详情见对应步骤。` : message);
      if (step) setStepNotice((current) => ({ ...current, [step]: message }));
    } finally {
      setBusy(null);
    }
  }

  function basePayload() {
    return { date, account_id: accountId };
  }

  return (
    <div className="space-y-6">
      <TaskChecklist
        hotspotReady={hotspotReady}
        matchGenerated={matchGenerated}
        matchSaved={matchSaved}
        generateGenerated={generateGenerated}
        generateSaved={generateSaved}
        installed={installed}
      />

      <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[180px_1fr_auto_auto]">
          <label className="text-sm font-bold text-[#343330]">
            日期
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setPrompts(null);
                resetRunState();
              }}
              className="mt-1 block w-full rounded-md border border-[#D8D3CB] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-bold text-[#343330]">
            账号
            <select
              value={accountId}
              onChange={(event) => {
                setAccountId(event.target.value);
                setPrompts(null);
                resetRunState();
              }}
              className="mt-1 block w-full rounded-md border border-[#D8D3CB] bg-white px-3 py-2 text-sm"
            >
              {accounts.map((item) => (
                <option key={item.account_id} value={item.account_id}>
                  {item.display_name ?? item.account_id} · {item.track_name ?? item.track_id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!accountId || busy !== null}
            onClick={() =>
              void run("跑前检查", async () => {
                const result = await postJson<ApiResult>("/api/ops/status", basePayload());
                return result.output || "跑前检查通过，可以继续。";
              })
            }
            className="self-end rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
          >
            {busy === "跑前检查" ? "检查中" : "跑前检查"}
          </button>
          <Link
            href={resultHref}
            className="self-end rounded-md border border-[#B8B5AD] bg-white px-4 py-2 text-center text-sm font-medium text-[#343330] no-underline hover:bg-[#F3F1EC]"
          >
            查看结果页
          </Link>
        </div>
        <div className="mt-3 rounded-md border border-[#E8E6E1] bg-[#FBFAF7] px-3 py-2 text-sm text-[#4A4A47]" aria-live="polite">
          {notice}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1E]">1. 准备今天的热点</h2>
            <p className="text-sm text-[#7A7770]">先让 GPT 帮你找热点，再把结果粘回来保存。系统会自动放到正确位置。</p>
          </div>
          <button
            type="button"
            disabled={!accountId || busy !== null}
            onClick={() =>
              void run("刷新热点提示词", async () => {
                const result = await postJson<{ ok: boolean; prompts: PromptBundle }>("/api/ops/hotspot-prompts", basePayload());
                setPrompts(result.prompts);
                return "热点提示词已准备好。复制给 GPT 后，把结果粘回下面两个框。";
              }, "setup")
            }
            className="rounded-md border border-[#B8B5AD] bg-white px-4 py-2 text-sm font-medium text-[#343330] hover:bg-[#F3F1EC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "刷新热点提示词" ? "刷新中" : "刷新热点提示词"}
          </button>
        </div>
        <StepNotice message={stepNotice.setup} />

        {prompts ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {broadPromptPanels.map((prompt) => (
              <PromptPanel key={prompt.id} title={prompt.title} text={prompt.text} />
            ))}
            <PromptPanel title="找本赛道热点的提示词" text={prompts.search} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#D8D3CB] bg-white p-4 text-sm text-[#6B6963]">
            先刷新热点提示词。
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
            <PasteBox
              label="粘贴全网热点结果"
              value={broadPool}
              onChange={(value) => {
                setBroadPool(value);
                setBroadSaved(false);
              }}
              helper="把多个全网提示词返回的 JSON 都粘在这里再保存；可以是一个数组、多个数组或多个对象。保存会写入同一个公共热点池。"
              placeholder='可连续粘贴多个 JSON 数组，例如 [{"title":"..."}]\n\n[{"title":"..."}]'
            />
            <TechPath pathText={`data/hotspots/${date}.json`} />
            <button
              type="button"
              disabled={!broadPool.trim() || busy !== null}
              onClick={() =>
                void run("保存全网热点", async () => {
                  const result = await postJson<ApiResult>("/api/ops/hotspots", {
                    date,
                    kind: "broad",
                    text: broadPool,
                  });
                  setBroadSaved(true);
                  return `已保存 ${result.count} 条全网热点。`;
                }, "broad")
              }
              className="mt-3 rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
            >
              {busy === "保存全网热点" ? "保存中" : "保存全网热点"}
            </button>
            <StepNotice message={stepNotice.broad} />
          </section>

          <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
            <PasteBox
              label="粘贴本赛道热点结果"
              value={trackPool}
              onChange={(value) => {
                setTrackPool(value);
                setTrackSaved(false);
              }}
              helper="这里放和当前账号赛道更相关的热点。没有 hotspot_id 也可以，系统会按日期和赛道自动补。没有合适热点时不要硬编。"
              placeholder='粘贴 JSON 数组，例如 [{"hotspot_id":"hs-20260630-edu-001","title":"...","summary":"..."}]'
            />
            <TechPath pathText={`data/hotspots/tracks/${trackId || "<track_id>"}/${date}.json`} />
            <button
              type="button"
              disabled={!trackPool.trim() || !trackId || busy !== null}
              onClick={() =>
                void run("保存赛道热点", async () => {
                  const result = await postJson<ApiResult>("/api/ops/hotspots", {
                    date,
                    kind: "track",
                    track_id: trackId,
                    text: trackPool,
                  });
                  setTrackSaved(true);
                  return `已保存 ${result.count} 条赛道热点。`;
                }, "track")
              }
              className="mt-3 rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
            >
              {busy === "保存赛道热点" ? "保存中" : "保存赛道热点"}
            </button>
            <StepNotice message={stepNotice.track} />
          </section>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1E]">2. 让 GPT 判断哪些能发</h2>
            <p className="text-sm text-[#7A7770]">先生成判断提示词，复制给 GPT。GPT 会告诉你哪些热点必发、待拍板、别蹭。</p>
          </div>
          <button
            type="button"
            disabled={!accountId || busy !== null}
            onClick={() =>
              void run("生成判断提示词", async () => {
                const result = await postJson<{ ok: boolean; output?: string; prompts: PromptFile[] }>("/api/ops/prompts", {
                  ...basePayload(),
                  stage: "match",
                });
                setMatchPrompts(result.prompts);
                return `已生成 ${result.prompts.length} 条判断提示词。现在复制给 GPT，让它判断哪些能发。`;
              }, "matchPrompt")
            }
            className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
          >
            {busy === "生成判断提示词" ? "生成中" : "生成判断提示词"}
          </button>
          <StepNotice message={stepNotice.matchPrompt} />
          <PromptList title="GPT 判断提示词" prompts={matchPrompts} />
        </div>

        <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
          <PasteBox
            label="粘贴 GPT 的判断结果"
            value={matchReplies}
            onChange={(value) => {
              setMatchReplies(value);
              setMatchSaved(false);
            }}
            helper="把 GPT 返回的判断结果原样粘贴。可以一次粘一条，也可以粘一整个数组。"
            placeholder='例如 [{"hotspot_id":"hs-...","tier":"strong_pick","skip_reason":"","why_relevant":"..."}]'
          />
          <TechPath pathText={`data/runs/${date}/${accountId || "<account_id>"}/_inbox/match-<hotspot_id>.json`} />
          <button
            type="button"
            disabled={!matchReplies.trim() || busy !== null}
            onClick={() =>
              void run("保存判断结果", async () => {
                const result = await postJson<ApiResult>("/api/ops/inbox", {
                  ...basePayload(),
                  stage: "match",
                  text: matchReplies,
                });
                setMatchSaved(true);
                return `已保存 ${result.files?.length ?? 0} 个判断结果。`;
              }, "matchReply")
            }
            className="mt-3 rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
          >
            {busy === "保存判断结果" ? "保存中" : "保存判断结果"}
          </button>
          <StepNotice message={stepNotice.matchReply} />
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1E]">3. 让 GPT 做博士分析并生成内容草稿</h2>
            <p className="text-sm text-[#7A7770]">
              提示词会先接入本赛道的博士分析层，再要求输出内容 JSON。已经判断为“别蹭”的热点不用写内容。
            </p>
          </div>
          <button
            type="button"
            disabled={!accountId || busy !== null}
            onClick={() =>
              void run("生成内容提示词", async () => {
                const result = await postJson<{ ok: boolean; output?: string; prompts: PromptFile[] }>("/api/ops/prompts", {
                  ...basePayload(),
                  stage: "generate",
                });
                setGeneratePrompts(result.prompts);
                return `已生成 ${result.prompts.length} 条分析+内容提示词。现在复制给 GPT，让它先分析再写内容草稿。`;
              }, "generatePrompt")
            }
            className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
          >
            {busy === "生成内容提示词" ? "生成中" : "生成分析+内容提示词"}
          </button>
          <StepNotice message={stepNotice.generatePrompt} />
          <PromptList title="GPT 分析+内容提示词" prompts={generatePrompts} />
        </div>

        <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
          <PasteBox
            label="粘贴 GPT 的内容结果"
            value={generateReplies}
            onChange={(value) => {
              setGenerateReplies(value);
              setGenerateSaved(false);
            }}
            helper="把 GPT 写好的内容 JSON 粘回来。系统会在安装时做最后校验。"
            placeholder='例如 [{"hotspot_id":"hs-...","recommendation":"strong_pick","bridge_paths":[...],"content":{...}}]'
          />
          <TechPath pathText={`data/runs/${date}/${accountId || "<account_id>"}/_inbox/generate-<hotspot_id>.json`} />
          <button
            type="button"
            disabled={!generateReplies.trim() || busy !== null}
            onClick={() =>
              void run("保存内容结果", async () => {
                const result = await postJson<ApiResult>("/api/ops/inbox", {
                  ...basePayload(),
                  stage: "generate",
                  text: generateReplies,
                });
                setGenerateSaved(true);
                return `已保存 ${result.files?.length ?? 0} 个内容结果。`;
              }, "generateReply")
            }
            className="mt-3 rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
          >
            {busy === "保存内容结果" ? "保存中" : "保存内容结果"}
          </button>
          <StepNotice message={stepNotice.generateReply} />
        </section>
      </section>

      <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1E]">4. 安装到今日页面</h2>
            <p className="text-sm text-[#7A7770]">系统会检查格式、禁词、硬蹭和内容完整性。通过后，结果页才会更新。</p>
            <TechPath pathText={`data/today/${accountId || "<account_id>"}/latest.json`} />
          </div>
          <button
            type="button"
            disabled={!accountId || busy !== null}
            onClick={() =>
              void run("安装到今日页面", async () => {
                const result = await postJson<ApiResult>("/api/ops/ingest", basePayload());
                setInstalled(true);
                return result.output || "已安装到今日页面。";
              }, "install")
            }
            className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#B8B5AD]"
          >
            {busy === "安装到今日页面" ? "安装中" : "安装到今日页面"}
          </button>
        </div>
        <StepNotice message={stepNotice.install} />
      </section>
    </div>
  );
}
