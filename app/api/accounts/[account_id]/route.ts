import fs from "node:fs";
import path from "node:path";

import { tursoEnabled } from "@/lib/turso";

const DATA_DIR = path.join(process.cwd(), "data");

function safeAccountId(value: string): boolean {
  return /^acct-[a-z0-9-]+$/.test(value);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function moveIfExists(from: string, to: string) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return true;
}

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { account_id: string } },
): Promise<Response> {
  if (tursoEnabled()) {
    return Response.json(
      { ok: false, error: "线上不直接删除账号文件，请在本地归档后同步。" },
      { status: 403 },
    );
  }

  const accountId = params.account_id;
  if (!safeAccountId(accountId)) {
    return Response.json({ ok: false, error: "账号 ID 不合法。" }, { status: 400 });
  }

  const deletedAt = stamp();
  const accountPath = path.join(DATA_DIR, "accounts", `${accountId}.json`);
  const todayDir = path.join(DATA_DIR, "today", accountId);

  if (!fs.existsSync(accountPath)) {
    return Response.json({ ok: false, error: "账号文件不存在，可能已经被删除。" }, { status: 404 });
  }

  const archivedAccount = path.join(DATA_DIR, "deleted", "accounts", `${deletedAt}__${accountId}.json`);
  const archivedToday = path.join(DATA_DIR, "deleted", "today", `${deletedAt}__${accountId}`);

  try {
    moveIfExists(accountPath, archivedAccount);
    moveIfExists(todayDir, archivedToday);
    return Response.json({
      ok: true,
      account_id: accountId,
      archived_account: archivedAccount,
      archived_today: fs.existsSync(archivedToday) ? archivedToday : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
