import fs from "node:fs";
import path from "node:path";

import type { StoredAccount } from "@/lib/adaptation-types";

export const dynamic = "force-dynamic";

const SPARK_DIR = path.join(process.cwd(), "data", "spark-inbox");
const ACCOUNT_DIR = path.join(process.cwd(), "data", "accounts");

export type SparkStatus = "pending" | "ingested" | "rejected";

export type SparkRecord = {
  spark_id: string;
  account_id: string;
  track_id: string;
  text: string;
  created_at: string;
  status: SparkStatus;
  resolved_at: string | null;
  hotspot_id: string | null;
  reject_reason: string | null;
};

function safeAccountId(value: unknown): value is string {
  return typeof value === "string" && /^acct-[a-z0-9-]+$/.test(value);
}

function todayCompact(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function listSparkFiles(accountId?: string): string[] {
  if (accountId) {
    const dir = path.join(SPARK_DIR, accountId);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(dir, name));
  }
  if (!fs.existsSync(SPARK_DIR)) return [];
  return fs
    .readdirSync(SPARK_DIR)
    .flatMap((dirName) => listSparkFiles(dirName));
}

function nextSparkId(): string {
  const day = todayCompact();
  let max = 0;
  for (const filePath of listSparkFiles()) {
    const record = readJson<Partial<SparkRecord>>(filePath);
    const match = record?.spark_id?.match(new RegExp(`^spark-${day}-(\\d{3})$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `spark-${day}-${String(max + 1).padStart(3, "0")}`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("account_id") ?? undefined;
  if (accountId && !safeAccountId(accountId)) {
    return Response.json({ ok: false, error: "账号 ID 不合法。" }, { status: 400 });
  }
  const sparks = listSparkFiles(accountId)
    .map((filePath) => readJson<SparkRecord>(filePath))
    .filter((record): record is SparkRecord => Boolean(record?.spark_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return Response.json({ ok: true, sparks });
}

export async function POST(request: Request): Promise<Response> {
  let body: { account_id?: unknown; text?: unknown };
  try {
    body = (await request.json()) as { account_id?: unknown; text?: unknown };
  } catch {
    return Response.json({ ok: false, error: "提交内容不是有效 JSON。" }, { status: 400 });
  }

  if (!safeAccountId(body.account_id)) {
    return Response.json({ ok: false, error: "账号 ID 不合法。" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ ok: false, error: "请先写下你的灵感。" }, { status: 400 });
  }

  const accountPath = path.join(ACCOUNT_DIR, `${body.account_id}.json`);
  const account = readJson<StoredAccount>(accountPath);
  if (!account) {
    return Response.json({ ok: false, error: "账号不存在。" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const record: SparkRecord = {
    spark_id: nextSparkId(),
    account_id: body.account_id,
    track_id: account.track_id,
    text: body.text.trim(),
    created_at: now,
    status: "pending",
    resolved_at: null,
    hotspot_id: null,
    reject_reason: null,
  };
  const dir = path.join(SPARK_DIR, body.account_id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${record.spark_id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf-8");
  return Response.json({ ok: true, spark: record });
}
