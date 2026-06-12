// dashboard-data.ts — 今日总览 / 热点池 / 账号页的只读聚合层（双源，全异步）。

import type {
  AdaptationOutput,
  Recommendation,
  StoredAccount,
} from "@/lib/adaptation-types";
import type { TodayResponse } from "@/lib/api-contracts";
import { getDoc, listDocKeys, listDocs } from "@/lib/data-source";
import { loadDataAccounts, loadDataAccount } from "@/lib/file-data";

export type HotspotRecord = {
  hotspot_id: string;
  date?: string;
  title?: string;
  summary?: string;
  phenomenon?: string;
  spread_emotion?: string;
  people_involved?: string[];
  conflict_point?: string;
  fact_structure?: string;
  candidate_problem_dimensions?: string[];
  source_direction?: string;
  source_skill?: string;
  source_url?: string | null;
  heat_score_10?: number;
  platforms?: string[];
  /** "broad" = 公共池；"track:<track_id>" = 赛道定向池 */
  scope?: string;
};

export function scopeTrackId(hotspot: HotspotRecord): string | null {
  const scope = hotspot.scope ?? "broad";
  return scope.startsWith("track:") ? scope.slice("track:".length) : null;
}

export type TodayResponseWithMeta = TodayResponse & {
  date?: string;
  generated_at?: string;
};

export type AccountDayResult = {
  account: StoredAccount;
  response: TodayResponseWithMeta | null;
  date: string | null;
  counts: Record<Recommendation, number>;
};

export type MatrixCell = {
  account_id: string;
  status: Recommendation | "not_run" | "not_covered" | "out_of_scope";
  recommendation?: Recommendation;
  output?: AdaptationOutput;
  reason?: string;
};

export type MatrixRow = {
  hotspot: HotspotRecord;
  cells: MatrixCell[];
};

export type DashboardSnapshot = {
  date: string | null;
  dates: string[];
  prevDate: string | null;
  nextDate: string | null;
  latestDate: string | null;
  hotspots: HotspotRecord[];
  accounts: StoredAccount[];
  results: AccountDayResult[];
  matrix: MatrixRow[];
  totals: {
    hotspots: number;
    accounts: number;
    strong: number;
    maybe: number;
    skipped: number;
    judged: number;
  };
};

export type AccountHistoryRow = {
  date: string;
  strong: number;
  maybe: number;
  skipped: number;
  total: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listHotspotDates(): Promise<string[]> {
  const dates = new Set<string>();
  for (const key of await listDocKeys("hotspots_broad")) {
    if (DATE_RE.test(key)) dates.add(key);
  }
  for (const key of await listDocKeys("hotspots_track")) {
    const date = key.split("/")[1];
    if (date && DATE_RE.test(date)) dates.add(date);
  }
  return Array.from(dates).sort();
}

export async function latestHotspotDate(): Promise<string | null> {
  const dates = await listHotspotDates();
  return dates.length ? dates[dates.length - 1] : null;
}

export async function loadHotspots(date?: string | null): Promise<{ date: string | null; hotspots: HotspotRecord[] }> {
  const resolvedDate = date ?? (await latestHotspotDate());
  if (!resolvedDate) return { date: null, hotspots: [] };

  const merged: HotspotRecord[] = [];
  const seen = new Set<string>();

  // 公共池
  const broad = await getDoc<HotspotRecord[]>("hotspots_broad", resolvedDate);
  for (const h of Array.isArray(broad) ? broad : []) {
    if (!h?.hotspot_id || seen.has(h.hotspot_id)) continue;
    seen.add(h.hotspot_id);
    merged.push({ ...h, scope: h.scope ?? "broad" });
  }

  // 各赛道定向池（当日）
  const trackKeys = (await listDocKeys("hotspots_track")).filter((k) => k.endsWith(`/${resolvedDate}`));
  for (const key of trackKeys) {
    const trackId = key.split("/")[0];
    const pool = await getDoc<HotspotRecord[]>("hotspots_track", key);
    for (const h of Array.isArray(pool) ? pool : []) {
      if (!h?.hotspot_id || seen.has(h.hotspot_id)) continue;
      seen.add(h.hotspot_id);
      merged.push({ ...h, scope: h.scope ?? `track:${trackId}` });
    }
  }

  return { date: resolvedDate, hotspots: merged };
}

export async function resolveDateContext(date?: string | null) {
  const dates = await listHotspotDates();
  const latestDate = dates.length ? dates[dates.length - 1] : null;
  const resolvedDate = date && dates.includes(date) ? date : latestDate;
  const index = resolvedDate ? dates.indexOf(resolvedDate) : -1;
  return {
    date: resolvedDate,
    dates,
    latestDate,
    prevDate: index > 0 ? dates[index - 1] : null,
    nextDate: index >= 0 && index < dates.length - 1 ? dates[index + 1] : null,
  };
}

export async function loadTodayForDate(accountId: string, date: string): Promise<TodayResponseWithMeta | null> {
  const data = await getDoc<TodayResponseWithMeta>("today", `${accountId}/${date}`);
  return data?.board ? data : null;
}

function allOutputs(response: TodayResponseWithMeta | null): AdaptationOutput[] {
  if (!response?.board) return [];
  return [
    ...(response.board.picks ?? []),
    ...(response.board.also_ran ?? []),
    ...(response.board.skipped ?? []),
  ];
}

export function countsFor(response: TodayResponseWithMeta | null): Record<Recommendation, number> {
  const counts: Record<Recommendation, number> = {
    strong_pick: 0,
    maybe: 0,
    skip: 0,
  };
  for (const output of allOutputs(response)) {
    counts[output.recommendation] += 1;
  }
  return counts;
}

export function findOutput(response: TodayResponseWithMeta | null, hotspotId: string): AdaptationOutput | null {
  return allOutputs(response).find((output) => output.hotspot_id === hotspotId) ?? null;
}

export async function loadAccountDayResults(date: string, accountsIn?: StoredAccount[]): Promise<AccountDayResult[]> {
  const accounts = accountsIn ?? (await loadDataAccounts());
  return Promise.all(
    accounts.map(async (account) => {
      const response = await loadTodayForDate(account.account_id, date);
      return {
        account,
        response,
        date: response?.date ?? (response ? date : null),
        counts: countsFor(response),
      };
    }),
  );
}

export async function buildDashboardSnapshot(date?: string | null): Promise<DashboardSnapshot> {
  const dateContext = await resolveDateContext(date);
  const [hotspotData, accounts] = await Promise.all([
    loadHotspots(dateContext.date),
    loadDataAccounts(),
  ]);
  const results = hotspotData.date ? await loadAccountDayResults(hotspotData.date, accounts) : [];
  const resultByAccount = new Map(results.map((result) => [result.account.account_id, result]));

  const matrix = hotspotData.hotspots.map((hotspot) => {
    const poolTrackId = scopeTrackId(hotspot);
    const cells = accounts.map((account) => {
      if (poolTrackId && account.track_id !== poolTrackId) {
        return {
          account_id: account.account_id,
          status: "out_of_scope" as const,
          reason: "这条是其他赛道的定向热点，本账号不参与判定。",
        };
      }
      const result = resultByAccount.get(account.account_id);
      if (!result?.response) {
        return {
          account_id: account.account_id,
          status: "not_run" as const,
          reason: "这个账号当天还没有跑批结果。",
        };
      }
      const output = findOutput(result?.response ?? null, hotspot.hotspot_id);
      if (!output) {
        return {
          account_id: account.account_id,
          status: "not_covered" as const,
          reason: "这个账号当天跑过批，但结果里没有覆盖这条热点。",
        };
      }
      return {
        account_id: account.account_id,
        status: output.recommendation,
        recommendation: output.recommendation,
        output,
        reason: result?.response?.meta?.[hotspot.hotspot_id]?.reason ?? output.skip_reason ?? undefined,
      };
    });
    return { hotspot, cells };
  });

  const totals = results.reduce(
    (acc, result) => {
      acc.strong += result.counts.strong_pick;
      acc.maybe += result.counts.maybe;
      acc.skipped += result.counts.skip;
      acc.judged += result.counts.strong_pick + result.counts.maybe + result.counts.skip;
      return acc;
    },
    {
      hotspots: hotspotData.hotspots.length,
      accounts: accounts.length,
      strong: 0,
      maybe: 0,
      skipped: 0,
      judged: 0,
    },
  );

  return {
    date: hotspotData.date,
    dates: dateContext.dates,
    prevDate: dateContext.prevDate,
    nextDate: dateContext.nextDate,
    latestDate: dateContext.latestDate,
    hotspots: hotspotData.hotspots,
    accounts,
    results,
    matrix,
    totals,
  };
}

export async function loadAccountHistory(accountId: string): Promise<AccountHistoryRow[]> {
  const docs = (await listDocs<TodayResponseWithMeta>("today", `${accountId}/`))
    .map((doc) => ({
      date: doc.key.slice(accountId.length + 1),
      response: doc.body,
    }))
    .filter((doc) => DATE_RE.test(doc.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .reverse()
    .slice(0, 14);
  return docs.map(({ date, response }) => {
    const counts = countsFor(response?.board ? response : null);
    return {
      date,
      strong: counts.strong_pick,
      maybe: counts.maybe,
      skipped: counts.skip,
      total: counts.strong_pick + counts.maybe + counts.skip,
    };
  });
}

export async function loadAccountWorkbench(accountId: string, date?: string | null) {
  const account = await loadDataAccount(accountId);
  const resolvedDate = (await resolveDateContext(date)).date;
  const response = account && resolvedDate ? await loadTodayForDate(account.account_id, resolvedDate) : null;
  return {
    account,
    date: resolvedDate,
    response,
    counts: countsFor(response),
    history: account ? await loadAccountHistory(account.account_id) : [],
  };
}
