import fs from "node:fs";
import path from "node:path";

import type { AccountMemory, StoredAccount } from "@/lib/adaptation-types";
import { scanInternal } from "@/lib/adaptation-types";
import { tursoEnabled } from "@/lib/turso";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data", "accounts");
const BACKUP_DIR = path.join(DATA_DIR, ".bak");

function safeAccountId(value: string): boolean {
  return /^acct-[a-z0-9-]+$/.test(value);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

function scanMemory(memory: AccountMemory): string[] {
  return unique(collectStrings(memory).flatMap((text) => scanInternal(text)));
}

function pruneBackups(accountId: string) {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith(`${accountId}.`) && name.endsWith(".json"))
    .sort()
    .reverse();
  for (const name of backups.slice(5)) {
    fs.rmSync(path.join(BACKUP_DIR, name), { force: true });
  }
}

type MemoryPatchBody = {
  memory?: Partial<AccountMemory>;
};

export async function PATCH(
  request: Request,
  { params }: { params: { account_id: string } },
): Promise<Response> {
  const accountId = params.account_id;
  if (!safeAccountId(accountId)) {
    return Response.json({ ok: false, error: "账号 ID 不合法。" }, { status: 400 });
  }

  if (tursoEnabled()) {
    return Response.json({ ok: false, error: "线上暂不支持编辑，请在本地编辑。" }, { status: 403 });
  }

  let body: MemoryPatchBody;
  try {
    body = (await request.json()) as MemoryPatchBody;
  } catch {
    return Response.json({ ok: false, error: "提交内容不是有效 JSON。" }, { status: 400 });
  }

  if (!body?.memory || typeof body.memory !== "object" || Array.isArray(body.memory)) {
    return Response.json({ ok: false, error: "请提交要保存的账号记忆。" }, { status: 400 });
  }

  const accountPath = path.join(DATA_DIR, `${accountId}.json`);
  if (!fs.existsSync(accountPath)) {
    return Response.json({ ok: false, error: "账号文件不存在。" }, { status: 404 });
  }

  try {
    const account = JSON.parse(fs.readFileSync(accountPath, "utf-8")) as StoredAccount;
    const nextMemory: AccountMemory = { ...(account.memory ?? {}), ...body.memory };
    const hits = scanMemory(nextMemory);
    if (hits.length) {
      return Response.json({ ok: false, error: "账号记忆里有不能写入的词。", hits }, { status: 400 });
    }

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.copyFileSync(accountPath, path.join(BACKUP_DIR, `${accountId}.${timestamp()}.json`));
    pruneBackups(accountId);

    const memoryUpdatedAt = new Date().toISOString();
    const nextAccount: StoredAccount = {
      ...account,
      memory: nextMemory,
      memory_updated_at: memoryUpdatedAt,
    };
    fs.writeFileSync(accountPath, `${JSON.stringify(nextAccount, null, 2)}\n`, "utf-8");
    return Response.json({ ok: true, memory_updated_at: memoryUpdatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
