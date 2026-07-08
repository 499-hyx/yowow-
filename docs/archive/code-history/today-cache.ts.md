# Archived `lib/today-cache.ts`

> 归档说明：本文件原位于 `lib/today-cache.ts`。经引用检查，当前没有任何运行路径 import 它；当前网站读取 `data/today/<account_id>/latest.json`，今日结果由 `scripts/ingest.py` 安装。保留此文件仅用于追溯早期前端缓存方案。

```ts
"use client";

// 今日板缓存 + 反馈完成记录（localStorage，按账号×按天）。
// 决策 B（按需生成 + 缓存）的前端实现：工作台/今日页同一天复用同一份结果，
// 「刷新」才重新生成；反馈完成记录用于工作台「待反馈」计数与卡片已反馈态。

import type { StoredAccount } from "@/lib/adaptation-types";
import type { TodayRequest, TodayResponse } from "@/lib/api-contracts";

const CACHE_PREFIX = "yowow-adaptation.today.";
const FEEDBACK_PREFIX = "yowow-adaptation.feedback-done.";

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export type TodayStats = {
  picks: number;
  strong: number;
  maybe: number;
  skipped: number;
  mode: "live" | "sample";
  generated_at: string; // HH:mm
};

export function statsOf(resp: TodayResponse, generatedAt?: string): TodayStats {
  const strong = resp.board.picks.filter((o) => o.recommendation === "strong_pick").length;
  return {
    picks: resp.board.picks.length,
    strong,
    maybe: resp.board.picks.length - strong,
    skipped: resp.board.skipped.length,
    mode: resp.mode ?? "sample",
    generated_at: generatedAt ?? new Date().toTimeString().slice(0, 5),
  };
}

type CacheEntry = { date: string; resp: TodayResponse; stats: TodayStats };

export function saveTodayCache(accountId: string, resp: TodayResponse): TodayStats {
  const stats = statsOf(resp);
  try {
    // 清掉这个账号的旧日期缓存
    const prefix = `${CACHE_PREFIX}${accountId}.`;
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) window.localStorage.removeItem(k);
    }
    const entry: CacheEntry = { date: todayKey(), resp, stats };
    window.localStorage.setItem(`${prefix}${todayKey()}`, JSON.stringify(entry));
  } catch {
    // 缓存失败不影响主流程
  }
  return stats;
}

export function loadTodayCache(accountId: string): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${accountId}.${todayKey()}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    return entry?.resp?.board ? entry : null;
  } catch {
    return null;
  }
}

export function clearTodayCache(accountId: string): void {
  try {
    window.localStorage.removeItem(`${CACHE_PREFIX}${accountId}.${todayKey()}`);
  } catch {
    // 忽略
  }
}

// ── 统一取数：优先当天缓存，没有才请求并落缓存（force=true 强制重新生成） ──

export async function fetchToday(
  account: StoredAccount,
  force = false,
): Promise<{ resp: TodayResponse; stats: TodayStats; fromCache: boolean }> {
  if (!force) {
    const hit = loadTodayCache(account.account_id);
    if (hit) return { resp: hit.resp, stats: hit.stats, fromCache: true };
  }
  const req: TodayRequest = {
    account: {
      account_id: account.account_id,
      display_name: account.display_name,
      track_id: account.track_id,
      platform_id: account.platform_id,
      positioning_id: account.positioning_id,
    },
    memory: account.memory,
  };
  const res = await fetch("/api/today", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(String(res.status));
  const resp = (await res.json()) as TodayResponse;
  const stats = saveTodayCache(account.account_id, resp);
  return { resp, stats, fromCache: false };
}

// ── 反馈完成记录（账号×天 → 已反馈的 hotspot_id 集合） ──

export function feedbackDoneSet(accountId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${FEEDBACK_PREFIX}${accountId}.${todayKey()}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markFeedbackDone(accountId: string, hotspotId: string): void {
  try {
    const set = feedbackDoneSet(accountId);
    set.add(hotspotId);
    window.localStorage.setItem(
      `${FEEDBACK_PREFIX}${accountId}.${todayKey()}`,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // 忽略
  }
}
```
