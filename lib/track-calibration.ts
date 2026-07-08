// track-calibration.ts — 赛道页的只读校准视图。
//
// 它把热点 × 账号的结果矩阵按赛道搜索方向聚合，帮助维护者看：
// 哪些方向容易 strong/maybe/skip，哪些热点没有覆盖。
// 不写数据，不改变推荐结果。

import type { Recommendation, StoredAccount } from "@/lib/adaptation-types";
import { loadTrackSummaries, type TrackConfigSummary } from "@/lib/config-data";
import {
  buildDashboardSnapshot,
  type HotspotRecord,
  type MatrixCell,
  type MatrixRow,
} from "@/lib/dashboard-data";

export type TrackCalibrationCounts = Record<Recommendation | "not_run" | "not_covered" | "out_of_scope", number>;

export type TrackHotspotCalibration = {
  hotspot: HotspotRecord;
  cells: MatrixCell[];
  counts: TrackCalibrationCounts;
};

export type DirectionCalibrationRow = {
  direction: string;
  hotspots: TrackHotspotCalibration[];
  counts: TrackCalibrationCounts;
  skipRate: number | null;
};

export type TrackCalibrationSnapshot = {
  date: string | null;
  prevDate: string | null;
  nextDate: string | null;
  latestDate: string | null;
  tracks: TrackConfigSummary[];
  selectedTrack: TrackConfigSummary | null;
  trackAccounts: StoredAccount[];
  directions: string[];
  directionRows: DirectionCalibrationRow[];
  unassignedHotspots: TrackHotspotCalibration[];
  totals: TrackCalibrationCounts & {
    accounts: number;
    motifs: number;
    recalledHotspots: number;
    unassignedHotspots: number;
  };
};

function emptyCounts(): TrackCalibrationCounts {
  return {
    strong_pick: 0,
    maybe: 0,
    skip: 0,
    not_run: 0,
    not_covered: 0,
    out_of_scope: 0,
  };
}

function addCounts(target: TrackCalibrationCounts, source: TrackCalibrationCounts) {
  target.strong_pick += source.strong_pick;
  target.maybe += source.maybe;
  target.skip += source.skip;
  target.not_run += source.not_run;
  target.not_covered += source.not_covered;
  target.out_of_scope += source.out_of_scope;
}

function countsForCells(cells: MatrixCell[]): TrackCalibrationCounts {
  const counts = emptyCounts();
  for (const cell of cells) {
    counts[cell.status] += 1;
  }
  return counts;
}

function skipRateFor(counts: TrackCalibrationCounts): number | null {
  const judged = counts.strong_pick + counts.maybe + counts.skip;
  if (!judged) return null;
  return counts.skip / judged;
}

function pickTrack(tracks: TrackConfigSummary[], trackId?: string | null): TrackConfigSummary | null {
  if (!tracks.length) return null;
  if (trackId) {
    const requested = tracks.find((track) => track.track_id === trackId);
    if (requested) return requested;
  }
  return tracks.find((track) => track.bridge_directions.length > 0) ?? tracks[0] ?? null;
}

function narrowRow(row: MatrixRow, accountIds: Set<string>): TrackHotspotCalibration {
  const cells = row.cells.filter((cell) => accountIds.has(cell.account_id));
  return {
    hotspot: row.hotspot,
    cells,
    counts: countsForCells(cells),
  };
}

export async function buildTrackCalibrationSnapshot(
  date?: string | null,
  trackId?: string | null,
): Promise<TrackCalibrationSnapshot> {
  const tracks = await loadTrackSummaries();
  const selectedTrack = pickTrack(tracks, trackId);
  const dashboard = await buildDashboardSnapshot(date);
  const trackAccounts = selectedTrack
    ? dashboard.accounts.filter((account) => account.track_id === selectedTrack.track_id)
    : [];
  const accountIds = new Set(trackAccounts.map((account) => account.account_id));
  const directions = selectedTrack?.bridge_directions ?? [];
  const directionSet = new Set(directions);
  const rowsByDirection = new Map<string, TrackHotspotCalibration[]>(
    directions.map((direction) => [direction, []]),
  );
  const unassignedHotspots: TrackHotspotCalibration[] = [];

  for (const row of dashboard.matrix) {
    const narrowed = narrowRow(row, accountIds);
    const direction = row.hotspot.source_direction;
    if (direction && directionSet.has(direction)) {
      rowsByDirection.get(direction)?.push(narrowed);
    } else {
      unassignedHotspots.push(narrowed);
    }
  }

  const totals: TrackCalibrationSnapshot["totals"] = {
    ...emptyCounts(),
    accounts: trackAccounts.length,
    motifs: directions.length,
    recalledHotspots: 0,
    unassignedHotspots: unassignedHotspots.length,
  };

  const directionRows = directions.map((direction) => {
    const hotspots = rowsByDirection.get(direction) ?? [];
    const counts = emptyCounts();
    for (const hotspot of hotspots) {
      addCounts(counts, hotspot.counts);
      addCounts(totals, hotspot.counts);
    }
    totals.recalledHotspots += hotspots.length;
    return {
      direction,
      hotspots,
      counts,
      skipRate: skipRateFor(counts),
    };
  });

  return {
    date: dashboard.date,
    prevDate: dashboard.prevDate,
    nextDate: dashboard.nextDate,
    latestDate: dashboard.latestDate,
    tracks,
    selectedTrack,
    trackAccounts,
    directions,
    directionRows,
    unassignedHotspots,
    totals,
  };
}
