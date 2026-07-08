# Archived `lib/account-store.ts`

> 归档说明：本文件原位于 `lib/account-store.ts`。经引用检查，当前没有任何运行路径 import 它；当前 MVP 的账号事实源是 `data/accounts/`，前端通过只读 API/文件读取展示。保留此文件仅用于追溯早期 localStorage 多账号工作台，不要在这里继续开发账号流程。

```ts
"use client";

// 账号工作台存储（localStorage，全程 try-catch）。
// 核心理念：先有账号记忆，再有每日推荐。账号配置一次，长期沉淀；
// 只有新增赛道 / 新增账号才进 onboarding。
// 自动迁移旧版单账号档案（profile.v1）。当前文件驱动 MVP 的正式账号事实源是 data/accounts/。

import type { AccountMemory, StoredAccount } from "@/lib/adaptation-types";

const KEY = "yowow-adaptation.accounts.v1";
const ACTIVE_KEY = "yowow-adaptation.active-account.v1";
const LEGACY_PROFILE_KEY = "yowow-adaptation.profile.v1";

type Bag = { accounts: StoredAccount[] };

function readBag(): Bag {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const bag = JSON.parse(raw) as Bag;
      if (bag && Array.isArray(bag.accounts)) return bag;
    }
  } catch {
    // 读坏了当空仓
  }
  return { accounts: [] };
}

function writeBag(bag: Bag): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(bag));
  } catch {
    // 存不了不打断流程
  }
}

// 旧版单账号档案 → 迁成工作台账号（只迁一次）
function migrateLegacy(bag: Bag): Bag {
  try {
    const raw = window.localStorage.getItem(LEGACY_PROFILE_KEY);
    if (!raw) return bag;
    const p = JSON.parse(raw) as StoredAccount & { memory?: AccountMemory };
    if (p?.account_id && !bag.accounts.some((a) => a.account_id === p.account_id)) {
      bag.accounts.push({ ...p, memory: p.memory ?? {} });
      writeBag(bag);
    }
    window.localStorage.removeItem(LEGACY_PROFILE_KEY);
  } catch {
    // 迁移失败不影响
  }
  return bag;
}

export function listAccounts(): StoredAccount[] {
  return migrateLegacy(readBag()).accounts;
}

export function getAccount(accountId: string): StoredAccount | null {
  return listAccounts().find((a) => a.account_id === accountId) ?? null;
}

export function upsertAccount(account: StoredAccount): void {
  const bag = readBag();
  const i = bag.accounts.findIndex((a) => a.account_id === account.account_id);
  if (i >= 0) bag.accounts[i] = account;
  else bag.accounts.push(account);
  writeBag(bag);
}

export function updateMemory(accountId: string, memory: AccountMemory): boolean {
  const bag = readBag();
  const i = bag.accounts.findIndex((a) => a.account_id === accountId);
  if (i < 0) return false;
  bag.accounts[i] = { ...bag.accounts[i], memory, memory_updated_at: new Date().toISOString() };
  writeBag(bag);
  return true;
}

export function removeAccount(accountId: string): void {
  const bag = readBag();
  bag.accounts = bag.accounts.filter((a) => a.account_id !== accountId);
  writeBag(bag);
  try {
    if (window.localStorage.getItem(ACTIVE_KEY) === accountId) {
      window.localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // 忽略
  }
}

export function getActiveAccountId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveAccountId(accountId: string): void {
  try {
    window.localStorage.setItem(ACTIVE_KEY, accountId);
  } catch {
    // 忽略
  }
}

// 解析「当前要看哪个号」：URL ?account= 优先，其次上次激活的，最后第一个
export function resolveAccount(accountIdFromUrl?: string | null): StoredAccount | null {
  const all = listAccounts();
  if (all.length === 0) return null;
  if (accountIdFromUrl) {
    const hit = all.find((a) => a.account_id === accountIdFromUrl);
    if (hit) return hit;
  }
  const activeId = getActiveAccountId();
  if (activeId) {
    const hit = all.find((a) => a.account_id === activeId);
    if (hit) return hit;
  }
  return all[0];
}
```
