// data-source.ts — 网站唯一的数据读取口（双源）。
//
//   有 TURSO_DATABASE_URL → 读 Turso docs 表（Vercel 生产）
//   没有                  → 读本地 data/ + config/ 文件（本地开发，行为与旧版一致）
//
// kind/key 约定与 scripts/sync-to-db.py 完全一致：
//   account            key = account_id
//   today              key = "<account_id>/<date|latest>"
//   hotspots_broad     key = "YYYY-MM-DD"
//   hotspots_track     key = "<track_id>/YYYY-MM-DD"
//   track_config / bridge_directions / platform / positioning / account_profile  key = id
//
// 本文件只做"取 JSON 文档"，不理解业务字段——schema 即合约，由上层各取所需。

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

import { tursoEnabled, tursoQuery } from "@/lib/turso";

export type DocKind =
  | "account"
  | "today"
  | "hotspots_broad"
  | "hotspots_track"
  | "track_config"
  | "bridge_directions"
  | "platform"
  | "positioning"
  | "account_profile";

const BASE = process.cwd();

const FS_DIRS: Record<DocKind, { dir: string; twoLevel: boolean }> = {
  account: { dir: "data/accounts", twoLevel: false },
  today: { dir: "data/today", twoLevel: true },
  hotspots_broad: { dir: "data/hotspots", twoLevel: false },
  hotspots_track: { dir: "data/hotspots/tracks", twoLevel: true },
  track_config: { dir: "config/tracks", twoLevel: false },
  bridge_directions: { dir: "config/deprecated/bridge-directions", twoLevel: false },
  platform: { dir: "config/platforms", twoLevel: false },
  positioning: { dir: "config/positionings", twoLevel: false },
  account_profile: { dir: "config/account-profiles", twoLevel: false },
};

function parseSafe<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function parseRows<T>(rows: Record<string, string | null>[]): { key: string; body: T }[] {
  return rows
    .map((r) => ({ key: r.key ?? "", body: parseSafe<T>(r.body) }))
    .filter((r): r is { key: string; body: T } => Boolean(r.key) && r.body !== null);
}

// ── 文件后端 ─────────────────────────────────────────────────────────────

function fsGet(kind: DocKind, key: string): string | null {
  const { dir } = FS_DIRS[kind];
  const p = path.join(BASE, dir, `${key}.json`);
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function fsKeys(kind: DocKind, prefix?: string): string[] {
  const { dir, twoLevel } = FS_DIRS[kind];
  const root = path.join(BASE, dir);
  if (!fs.existsSync(root)) return [];
  const keys: string[] = [];
  if (!twoLevel) {
    for (const f of fs.readdirSync(root)) {
      const p = path.join(root, f);
      if (f.endsWith(".json") && fs.statSync(p).isFile()) keys.push(f.slice(0, -5));
    }
  } else {
    for (const a of fs.readdirSync(root)) {
      const sub = path.join(root, a);
      if (!fs.statSync(sub).isDirectory()) continue;
      for (const f of fs.readdirSync(sub)) {
        if (!f.endsWith(".json") || f.endsWith(".bak.json") || f.endsWith(".json.bak")) continue;
        keys.push(`${a}/${f.slice(0, -5)}`);
      }
    }
  }
  const filtered = prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  return filtered.sort();
}

// ── 统一接口 ─────────────────────────────────────────────────────────────

export const getDoc = cache(async function getDoc<T>(kind: DocKind, key: string): Promise<T | null> {
  if (tursoEnabled()) {
    const rows = await tursoQuery("SELECT body FROM docs WHERE kind = ? AND key = ?", [kind, key]);
    return parseSafe<T>(rows[0]?.body);
  }
  return parseSafe<T>(fsGet(kind, key));
});

export const getDocs = cache(async function getDocs<T>(kind: DocKind, keys: string[]): Promise<{ key: string; body: T }[]> {
  const uniqueKeys = Array.from(new Set(keys)).filter(Boolean);
  if (!uniqueKeys.length) return [];
  if (tursoEnabled()) {
    const placeholders = uniqueKeys.map(() => "?").join(",");
    const rows = await tursoQuery(
      `SELECT key, body FROM docs WHERE kind = ? AND key IN (${placeholders}) ORDER BY key`,
      [kind, ...uniqueKeys],
    );
    return parseRows<T>(rows);
  }
  return uniqueKeys
    .map((key) => ({ key, body: parseSafe<T>(fsGet(kind, key)) }))
    .filter((r): r is { key: string; body: T } => r.body !== null)
    .sort((a, b) => a.key.localeCompare(b.key));
});

export const listDocKeys = cache(async function listDocKeys(kind: DocKind, prefix?: string): Promise<string[]> {
  if (tursoEnabled()) {
    const rows = prefix
      ? await tursoQuery("SELECT key FROM docs WHERE kind = ? AND key LIKE ? ORDER BY key", [kind, `${prefix}%`])
      : await tursoQuery("SELECT key FROM docs WHERE kind = ? ORDER BY key", [kind]);
    return rows.map((r) => r.key ?? "").filter(Boolean);
  }
  return fsKeys(kind, prefix);
});

export const hasDoc = cache(async function hasDoc(kind: DocKind, key: string): Promise<boolean> {
  if (tursoEnabled()) {
    const rows = await tursoQuery("SELECT key FROM docs WHERE kind = ? AND key = ? LIMIT 1", [kind, key]);
    return rows.length > 0;
  }
  return fsGet(kind, key) !== null;
});

export const listDocs = cache(async function listDocs<T>(kind: DocKind, prefix?: string): Promise<{ key: string; body: T }[]> {
  if (tursoEnabled()) {
    const rows = prefix
      ? await tursoQuery("SELECT key, body FROM docs WHERE kind = ? AND key LIKE ? ORDER BY key", [kind, `${prefix}%`])
      : await tursoQuery("SELECT key, body FROM docs WHERE kind = ? ORDER BY key", [kind]);
    return rows
      .map((r) => ({ key: r.key ?? "", body: parseSafe<T>(r.body) }))
      .filter((r): r is { key: string; body: T } => Boolean(r.key) && r.body !== null);
  }
  return fsKeys(kind, prefix)
    .map((key) => ({ key, body: parseSafe<T>(fsGet(kind, key)) }))
    .filter((r): r is { key: string; body: T } => r.body !== null);
});

function likeToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/%/g, ".*").replace(/_/g, ".")}$`);
}

export const listDocsByKeyLike = cache(async function listDocsByKeyLike<T>(
  kind: DocKind,
  likePattern: string,
): Promise<{ key: string; body: T }[]> {
  if (tursoEnabled()) {
    const rows = await tursoQuery(
      "SELECT key, body FROM docs WHERE kind = ? AND key LIKE ? ORDER BY key",
      [kind, likePattern],
    );
    return parseRows<T>(rows);
  }
  const matcher = likeToRegExp(likePattern);
  return fsKeys(kind)
    .filter((key) => matcher.test(key))
    .map((key) => ({ key, body: parseSafe<T>(fsGet(kind, key)) }))
    .filter((r): r is { key: string; body: T } => r.body !== null)
    .sort((a, b) => a.key.localeCompare(b.key));
});
