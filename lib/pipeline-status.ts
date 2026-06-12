import fs from "node:fs";
import path from "node:path";

type StatusKind = "ok" | "missing" | "info";

export type PipelineStatusItem = {
  key: string;
  label: string;
  status: StatusKind;
  detail: string;
  command?: string;
};

export type PipelineStatus = {
  date: string;
  items: PipelineStatusItem[];
};

type AccountRecord = {
  account_id?: string;
  display_name?: string;
  status?: string;
};

type TrackRecord = {
  track_id?: string;
  track_name?: string;
  status?: string;
};

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function listJson<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson<T>(path.join(dir, name)))
    .filter((item): item is T => item !== null);
}

function countArrayFile(filePath: string): number {
  const data = readJson<unknown>(filePath);
  return Array.isArray(data) ? data.length : 0;
}

function pendingSparkCount(base: string): number {
  const root = path.join(base, "data", "spark-inbox");
  if (!fs.existsSync(root)) return 0;
  let count = 0;
  for (const accountDir of fs.readdirSync(root)) {
    const dir = path.join(root, accountDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const record of listJson<{ status?: string }>(dir)) {
      if (record.status === "pending") count += 1;
    }
  }
  return count;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getPipelineStatus(date: string = todayString(), base = process.cwd()): PipelineStatus {
  const items: PipelineStatusItem[] = [];
  const broadPath = path.join(base, "data", "hotspots", `${date}.json`);
  const broadExists = fs.existsSync(broadPath);
  items.push({
    key: "broad",
    label: "公共池",
    status: broadExists ? "ok" : "missing",
    detail: broadExists ? `${countArrayFile(broadPath)} 条` : "未抓",
    command: broadExists ? undefined : "抓今天的热点",
  });

  const tracks = listJson<TrackRecord>(path.join(base, "config", "tracks"))
    .filter((track) => track.track_id && (track.status === "approved" || track.status === "reference"))
    .sort((a, b) => (a.track_name ?? a.track_id ?? "").localeCompare(b.track_name ?? b.track_id ?? ""));
  for (const track of tracks) {
    const trackId = track.track_id!;
    const trackPath = path.join(base, "data", "hotspots", "tracks", trackId, `${date}.json`);
    const exists = fs.existsSync(trackPath);
    const trackName = track.track_name ?? trackId;
    items.push({
      key: `track:${trackId}`,
      label: `${trackName}池`,
      status: exists ? "ok" : "missing",
      detail: exists ? `${countArrayFile(trackPath)} 条` : "未抓",
      command: exists ? undefined : `只给 ${trackName} 抓热点`,
    });
  }

  const accounts = listJson<AccountRecord>(path.join(base, "data", "accounts"))
    .filter((account) => account.account_id && account.status !== "paused")
    .sort((a, b) => (a.display_name ?? a.account_id ?? "").localeCompare(b.display_name ?? b.account_id ?? ""));
  const missingAccounts = accounts.filter((account) => {
    return !fs.existsSync(path.join(base, "data", "today", account.account_id!, `${date}.json`));
  });
  items.push({
    key: "accounts",
    label: "跑批",
    status: missingAccounts.length ? "missing" : "ok",
    detail: `${accounts.length - missingAccounts.length}/${accounts.length}${missingAccounts.length ? `（${missingAccounts.map((a) => a.display_name ?? a.account_id).join("、")}未跑）` : ""}`,
    command: missingAccounts.length ? `${missingAccounts[0].display_name ?? missingAccounts[0].account_id}今天发什么` : undefined,
  });

  const sparkPending = pendingSparkCount(base);
  items.push({
    key: "spark",
    label: "灵感待处理",
    status: sparkPending > 0 ? "missing" : "ok",
    detail: `${sparkPending}`,
    command: sparkPending > 0 ? "处理灵感收件箱" : undefined,
  });

  return { date, items };
}
