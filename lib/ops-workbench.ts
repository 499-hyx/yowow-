import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileDefault = promisify(execFileCallback);

type ExecFileResult = { stdout: string; stderr: string };
type ExecFileLike = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<ExecFileResult>;

type CommandFailure = {
  code?: string;
  stdout?: string;
  stderr?: string;
  message?: string;
};

type CommandSpec = {
  command: string;
  prefixArgs: string[];
};

type AccountRecord = {
  account_id?: string;
  display_name?: string;
  status?: string;
  track_id?: string;
};

type TrackRecord = {
  track_id?: string;
  track_name?: string;
  status?: string;
  daily_search_question?: string;
  bridge?: {
    search_brief?: string;
    search_directions?: string[];
  };
};

type SavedFile = {
  relativePath: string;
};

export type OpsCopyPrompt = {
  id: string;
  title: string;
  text: string;
};

export type OpsPromptBundle = {
  account: AccountRecord;
  track: TrackRecord;
  broad: string;
  broadPrompts: OpsCopyPrompt[];
  search: string;
};

export type RunCommandResult = {
  ok: boolean;
  output: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_RE = /^acct-[a-z0-9-]+$/;
const ID_RE = /^[a-z0-9-]+$/;
const STAGES = new Set(["match", "generate"]);

function pythonCandidates(): CommandSpec[] {
  const configured = process.env.YOWOW_PYTHON || process.env.PYTHON;
  const candidates: CommandSpec[] = configured ? [{ command: configured, prefixArgs: [] }] : [];
  if (process.platform === "win32") {
    candidates.push({ command: "py", prefixArgs: ["-3"] });
    candidates.push({ command: "python", prefixArgs: [] });
    candidates.push({ command: "python3", prefixArgs: [] });
  } else {
    candidates.push({ command: "python3", prefixArgs: [] });
    candidates.push({ command: "python", prefixArgs: [] });
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.command}\0${candidate.prefixArgs.join("\0")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function commandOutput(error: CommandFailure): string {
  return `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`.trim();
}

function pythonMissingMessage(candidates: CommandSpec[]): string {
  const tried = candidates
    .map((candidate) => [candidate.command, ...candidate.prefixArgs].join(" "))
    .join("、");
  return [
    "没有找到可用的 Python 解释器。",
    `已尝试：${tried}。`,
    "Windows 建议安装 Python 3 后确保 python 或 py 在 PATH 中，或设置 YOWOW_PYTHON 指向 python.exe。",
  ].join("");
}

async function runPythonScript({
  base,
  scriptArgs,
  execFile,
}: {
  base: string;
  scriptArgs: string[];
  execFile: ExecFileLike;
}): Promise<RunCommandResult> {
  const candidates = pythonCandidates();
  let lastError: CommandFailure | null = null;

  for (const candidate of candidates) {
    try {
      const result = await execFile(candidate.command, [...candidate.prefixArgs, ...scriptArgs], { cwd: base });
      return { ok: true, output: `${result.stdout}${result.stderr}`.trim() };
    } catch (error) {
      const err = error as CommandFailure;
      lastError = err;
      if (err.code === "ENOENT") continue;
      return { ok: false, output: commandOutput(err) };
    }
  }

  return {
    ok: false,
    output: lastError?.code === "ENOENT" ? pythonMissingMessage(candidates) : commandOutput(lastError ?? {}),
  };
}

function ensureDate(date: string): string {
  if (!DATE_RE.test(date)) throw new Error("日期必须是 YYYY-MM-DD。");
  return date;
}

function ensureAccountId(accountId: string): string {
  if (!ACCOUNT_RE.test(accountId)) throw new Error("账号 ID 不合法。");
  return accountId;
}

function ensureTrackId(trackId: string): string {
  if (!ID_RE.test(trackId)) throw new Error("赛道 ID 不合法。");
  return trackId;
}

function ensureStage(stage: string): "match" | "generate" {
  if (!STAGES.has(stage)) throw new Error("stage 只能是 match 或 generate。");
  return stage as "match" | "generate";
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function promptPath(base: string, ...segments: string[]): string {
  return path.join(base, "prompts", ...segments);
}

function relative(base: string, filePath: string): string {
  return path.relative(base, filePath).split(path.sep).join("/");
}

function replaceAllLiteral(text: string, replacements: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

function parsePromptFrontMatter(text: string): { metadata: Record<string, string>; body: string } {
  const normalized = text.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { metadata: {}, body: text };

  const metadata: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const quoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"));
    metadata[key] = quoted ? rawValue.slice(1, -1) : rawValue;
  }

  return { metadata, body: normalized.slice(match[0].length) };
}

function readRegisteredPromptBody({
  base,
  sourceDir,
  entryName,
  metadata,
  body,
}: {
  base: string;
  sourceDir: string;
  entryName: string;
  metadata: Record<string, string>;
  body: string;
}): string {
  const sourceFile = metadata.source_file?.trim();
  if (!sourceFile) return body;

  const promptsRoot = path.resolve(base, "prompts");
  const targetPath = path.resolve(sourceDir, sourceFile);
  const insidePrompts = targetPath.startsWith(`${promptsRoot}${path.sep}`);
  if (!insidePrompts) {
    throw new Error(`公共热点提示词 source_file 越界: prompts/公共热点/来源注册/${entryName}`);
  }
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    throw new Error(`公共热点提示词 source_file 不存在: prompts/公共热点/来源注册/${entryName}`);
  }
  return readText(targetPath);
}

function loadHotspotSourcePrompts(base: string, safeDate: string): OpsCopyPrompt[] {
  const sourceDir = promptPath(base, "公共热点", "来源注册");
  if (!fs.existsSync(sourceDir)) return [];

  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => {
      const lower = entry.name.toLowerCase();
      return (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        lower !== "readme.md" &&
        entry.name !== "说明.md" &&
        !entry.name.startsWith("_")
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const raw = readText(path.join(sourceDir, entry.name));
      const { metadata, body } = parsePromptFrontMatter(raw);
      if ((metadata.enabled ?? "true").toLowerCase() === "false") return [];

      const id = (metadata.id || path.basename(entry.name, ".md")).trim();
      if (!ID_RE.test(id)) {
        throw new Error(`公共热点提示词 id 不合法: prompts/公共热点/来源注册/${entry.name}`);
      }

      return [
        {
          id,
          title: (metadata.title || id).trim(),
          text: replaceAllLiteral(
            readRegisteredPromptBody({
              base,
              sourceDir,
              entryName: entry.name,
              metadata,
              body,
            })
              .trimStart()
              .trimEnd(),
            { date: safeDate },
          ),
        },
      ];
    });
}

function mergeCopyPrompts(primary: OpsCopyPrompt[], fallback: OpsCopyPrompt[]): OpsCopyPrompt[] {
  const seen = new Set<string>();
  const merged: OpsCopyPrompt[] = [];
  for (const prompt of [...primary, ...fallback]) {
    if (seen.has(prompt.id)) continue;
    seen.add(prompt.id);
    merged.push(prompt);
  }
  return merged;
}

function renderTrackSearchPrompt({
  base,
  trackId,
  track,
  safeDate,
}: {
  base: string;
  trackId: string;
  track: TrackRecord;
  safeDate: string;
}): string {
  const safeTrack = ensureTrackId(trackId);
  const specificPath = promptPath(base, "赛道热点", safeTrack, "热点搜索.md");
  const fallbackPath = promptPath(base, "赛道热点", "通用赛道热点搜索.md");
  const templatePath = fs.existsSync(specificPath) ? specificPath : fallbackPath;
  const directions = track.bridge?.search_directions ?? [];

  return replaceAllLiteral(readText(templatePath), {
    date: safeDate,
    track: track.track_name ?? track.track_id ?? safeTrack,
    search_brief: track.bridge?.search_brief ?? track.daily_search_question ?? "",
    directions: directions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
  });
}

function loadAccount(base: string, accountId: string): AccountRecord {
  const safe = ensureAccountId(accountId);
  const filePath = path.join(base, "data", "accounts", `${safe}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`账号文件不存在: data/accounts/${safe}.json`);
  return readJson<AccountRecord>(filePath);
}

function loadTrack(base: string, trackId: string): TrackRecord {
  const safe = ensureTrackId(trackId);
  const filePath = path.join(base, "config", "tracks", `${safe}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`赛道文件不存在: config/tracks/${safe}.json`);
  return readJson<TrackRecord>(filePath);
}

function parseJsonValues(text: string): unknown[] {
  const values: unknown[] = [];
  let start = -1;
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      if (depth > 0) quote = char;
      continue;
    }

    if (char === "{" || char === "[") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const snippet = text.slice(start, i + 1);
        values.push(JSON.parse(snippet));
        start = -1;
      }
    }
  }

  if (!values.length) {
    throw new Error("没有找到可解析的 JSON。");
  }
  return values;
}

function flattenJsonObjects(text: string): Record<string, unknown>[] {
  const parsed = parseJsonValues(text);
  const records = parsed.flatMap((item) => (Array.isArray(item) ? item : [item]));
  if (!records.length || !records.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    throw new Error("请粘贴 JSON 对象或 JSON 数组。");
  }
  return records as Record<string, unknown>[];
}

function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return items.length ? items : undefined;
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return undefined;
}

function normalizeHotspotPoolItem({
  item,
  index,
  date,
  kind,
  trackId,
}: {
  item: Record<string, unknown>;
  index: number;
  date: string;
  kind: "broad" | "track";
  trackId?: string;
}): Record<string, unknown> {
  const title = item.title;
  if (typeof title !== "string" || !title.trim()) {
    throw new Error("热点池每一项都必须有 title。");
  }

  const safeTrack = kind === "track" ? ensureTrackId(trackId ?? "") : undefined;
  const direction = kind === "broad" ? "broad" : safeTrack;
  const scope = kind === "broad" ? "broad" : `track:${safeTrack}`;
  const fallbackId = `hs-${compactDate(date)}-${direction}-${String(index + 1).padStart(3, "0")}`;
  const hotspotId =
    typeof item.hotspot_id === "string" && item.hotspot_id.trim()
      ? item.hotspot_id.trim()
      : typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : fallbackId;

  return {
    ...item,
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : hotspotId,
    hotspot_id: hotspotId,
    date: typeof item.date === "string" && item.date.trim() ? item.date.trim() : date,
    source_skill:
      typeof item.source_skill === "string" && item.source_skill.trim() ? item.source_skill.trim() : "external-llm-manual",
    source_direction:
      typeof item.source_direction === "string" && item.source_direction.trim() ? item.source_direction.trim() : direction,
    scope: typeof item.scope === "string" && item.scope.trim() ? item.scope.trim() : scope,
    conflict_point:
      typeof item.conflict_point === "string" && item.conflict_point.trim()
        ? item.conflict_point
        : typeof item.conflict_hint === "string" && item.conflict_hint.trim()
          ? item.conflict_hint
          : item.conflict_point,
    candidate_problem_dimensions:
      asStringArray(item.candidate_problem_dimensions) ?? asStringArray(item.problem_dimensions_hint) ?? item.candidate_problem_dimensions,
    heat_score_10:
      typeof item.heat_score_10 === "number"
        ? item.heat_score_10
        : typeof item.est_heat_score_10 === "number"
          ? item.est_heat_score_10
          : item.heat_score_10,
  };
}

export function renderHotspotPrompts({
  base = process.cwd(),
  date,
  accountId,
}: {
  base?: string;
  date: string;
  accountId: string;
}): OpsPromptBundle {
  const safeDate = ensureDate(date);
  const account = loadAccount(base, accountId);
  if (!account.track_id) throw new Error("账号文件缺少 track_id。");
  const track = loadTrack(base, account.track_id);

  const broad = replaceAllLiteral(readText(promptPath(base, "公共热点", "平台原生全网热点.md")), {
    date: safeDate,
  });
  const legacyBroadPrompts: OpsCopyPrompt[] = [
    {
      id: "platform-native",
      title: "平台原生全网热点",
      text: broad,
    },
  ];
  const broadPrompts = mergeCopyPrompts(loadHotspotSourcePrompts(base, safeDate), legacyBroadPrompts);
  const search = renderTrackSearchPrompt({ base, trackId: account.track_id, track, safeDate });
  return { account, track, broad, broadPrompts, search };
}

export function saveHotspotPool({
  base = process.cwd(),
  date,
  kind,
  trackId,
  text,
}: {
  base?: string;
  date: string;
  kind: "broad" | "track";
  trackId?: string;
  text: string;
}): SavedFile & { count: number } {
  const safeDate = ensureDate(date);
  const safeTrackId = kind === "track" ? ensureTrackId(trackId ?? "") : undefined;
  const parsed = parseJsonValues(text);
  const pool = parsed.flatMap((item) => (Array.isArray(item) ? item : [item]));
  if (!pool.length) throw new Error("热点池必须是 JSON 对象或 JSON 数组。");
  const normalized = pool.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("热点池每一项必须是对象。");
    return normalizeHotspotPoolItem({
      item: item as Record<string, unknown>,
      index,
      date: safeDate,
      kind,
      trackId: safeTrackId,
    });
  });

  const filePath =
    kind === "broad"
      ? path.join(base, "data", "hotspots", `${safeDate}.json`)
      : path.join(base, "data", "hotspots", "tracks", safeTrackId ?? "", `${safeDate}.json`);
  writeJson(filePath, normalized);
  return { relativePath: relative(base, filePath), count: normalized.length };
}

export function saveInboxReplies({
  base = process.cwd(),
  date,
  accountId,
  stage,
  text,
}: {
  base?: string;
  date: string;
  accountId: string;
  stage: string;
  text: string;
}): { files: SavedFile[] } {
  const safeDate = ensureDate(date);
  const safeAccount = ensureAccountId(accountId);
  const safeStage = ensureStage(stage);
  const records = flattenJsonObjects(text);
  const files: SavedFile[] = [];
  const missingPrompts: string[] = [];

  for (const record of records) {
    const hotspotId = record.hotspot_id;
    if (typeof hotspotId !== "string" || !hotspotId.trim()) {
      throw new Error("每个回贴 JSON 都必须有 hotspot_id。");
    }
    const promptPath = path.join(
      base,
      "data",
      "runs",
      safeDate,
      safeAccount,
      "prompts",
      `${safeStage}-${hotspotId}.txt`,
    );
    if (!fs.existsSync(promptPath)) {
      missingPrompts.push(String(hotspotId));
    }
  }

  if (missingPrompts.length) {
    throw new Error(
      `当前账号还没有生成这些 ${safeStage} 提示词：${missingPrompts.slice(0, 8).join(", ")}。` +
        "请确认页面上选的是生成这批提示词时的账号；如果选错账号，请切回正确账号后再保存。",
    );
  }

  for (const record of records) {
    const hotspotId = String(record.hotspot_id);
    const filePath = path.join(
      base,
      "data",
      "runs",
      safeDate,
      safeAccount,
      "_inbox",
      `${safeStage}-${hotspotId}.json`,
    );
    writeJson(filePath, record);
    files.push({ relativePath: relative(base, filePath) });
  }

  return { files };
}

export function listPromptFiles({
  base = process.cwd(),
  date,
  accountId,
  stage,
}: {
  base?: string;
  date: string;
  accountId: string;
  stage: string;
}): Array<SavedFile & { name: string; content: string; hotspot_id: string }> {
  const safeDate = ensureDate(date);
  const safeAccount = ensureAccountId(accountId);
  const safeStage = ensureStage(stage);
  const promptDir = path.join(base, "data", "runs", safeDate, safeAccount, "prompts");
  if (!fs.existsSync(promptDir)) return [];
  return fs
    .readdirSync(promptDir)
    .filter((name) => name.startsWith(`${safeStage}-`) && name.endsWith(".txt"))
    .sort()
    .map((name) => {
      const filePath = path.join(promptDir, name);
      const hotspot_id = name.slice(safeStage.length + 1, -".txt".length);
      return {
        name,
        hotspot_id,
        relativePath: relative(base, filePath),
        content: readText(filePath),
      };
    });
}

export async function runPreflight({
  base = process.cwd(),
  date,
  accountId,
  execFile = execFileDefault,
}: {
  base?: string;
  date: string;
  accountId: string;
  execFile?: ExecFileLike;
}): Promise<RunCommandResult> {
  const args = ["scripts/status.py", "--date", ensureDate(date), "--preflight", ensureAccountId(accountId)];
  return runPythonScript({ base, scriptArgs: args, execFile });
}

export async function runMakePrompt({
  base = process.cwd(),
  date,
  accountId,
  stage,
  execFile = execFileDefault,
}: {
  base?: string;
  date: string;
  accountId: string;
  stage: string;
  execFile?: ExecFileLike;
}): Promise<RunCommandResult & { prompts: ReturnType<typeof listPromptFiles> }> {
  const safeDate = ensureDate(date);
  const safeAccount = ensureAccountId(accountId);
  const safeStage = ensureStage(stage);
  const args = ["scripts/make-prompt.py", safeAccount, "--date", safeDate, "--step", safeStage, "--no-print"];
  const result = await runPythonScript({ base, scriptArgs: args, execFile });
  if (!result.ok) {
    return {
      ok: false,
      output: result.output,
      prompts: [],
    };
  }
  return {
    ...result,
    prompts: listPromptFiles({ base, date: safeDate, accountId: safeAccount, stage: safeStage }),
  };
}

export async function runIngest({
  base = process.cwd(),
  date,
  accountId,
  execFile = execFileDefault,
}: {
  base?: string;
  date: string;
  accountId: string;
  execFile?: ExecFileLike;
}): Promise<RunCommandResult> {
  const safeDate = ensureDate(date);
  const safeAccount = ensureAccountId(accountId);
  const inbox = `data/runs/${safeDate}/${safeAccount}/_inbox`;
  const args = ["scripts/ingest.py", safeAccount, inbox, "--date", safeDate];
  return runPythonScript({ base, scriptArgs: args, execFile });
}
