// file-data.ts — 账号 / 今日推荐读取层（双源：Turso 或本地文件，见 data-source.ts）。
//
// 读取原则：
//   - 文档缺失  → 返回 null（调用方给用户人话提示）
//   - latest 损坏 → 尝试最近日期归档；全没有才返回 null
//   - 不调 LLM，不写数据，纯读取

import type { StoredAccount } from "@/lib/adaptation-types";
import type { TodayResponse } from "@/lib/api-contracts";
import { getDoc, listDocKeys, listDocs } from "@/lib/data-source";

// ── 账号列表 ──────────────────────────────────────────────────────────

export async function loadDataAccounts(): Promise<StoredAccount[]> {
  const docs = await listDocs<StoredAccount>("account");
  return docs.map((d) => d.body).filter((a) => Boolean(a?.account_id));
}

export async function loadDataAccount(accountId: string): Promise<StoredAccount | null> {
  return getDoc<StoredAccount>("account", accountId);
}

// ── 今日推荐 ──────────────────────────────────────────────────────────

export type TodayFileResult = {
  response: TodayResponse;
  fallbackDate?: string; // 当 latest 损坏、回退到归档时有值
};

export async function loadTodayFile(accountId: string): Promise<TodayFileResult | null> {
  // 优先 latest
  const latest = await getDoc<TodayResponse>("today", `${accountId}/latest`);
  if (latest?.board) return { response: latest };

  // 回退：最新日期归档
  const keys = (await listDocKeys("today", `${accountId}/`))
    .map((k) => k.slice(accountId.length + 1))
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .reverse();
  for (const date of keys) {
    const data = await getDoc<TodayResponse>("today", `${accountId}/${date}`);
    if (data?.board) return { response: data, fallbackDate: date };
  }
  return null;
}
