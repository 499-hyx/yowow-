import Link from "next/link";

import DateContextBar from "@/components/adaptation/DateContextBar";
import type { MatrixCell } from "@/lib/dashboard-data";
import {
  buildTrackCalibrationSnapshot,
  type DirectionCalibrationRow,
  type TrackCalibrationCounts,
  type TrackHotspotCalibration,
} from "@/lib/track-calibration";

export const dynamic = "force-dynamic";

function labelFor(status: MatrixCell["status"]) {
  if (status === "strong_pick") return "必发";
  if (status === "maybe") return "拍板";
  if (status === "skip") return "别蹭";
  if (status === "not_run") return "未跑批";
  return "未覆盖";
}

function toneFor(status: MatrixCell["status"]) {
  if (status === "strong_pick") return "border-[#A9C682] bg-[#F2F8E9] text-[#36591C]";
  if (status === "maybe") return "border-[#E1C58F] bg-[#FFF8EA] text-[#755019]";
  if (status === "skip") return "border-[#D8D3CB] bg-[#F3F1EC] text-[#4A4A47]";
  if (status === "not_run") return "border-[#E3E0D8] bg-[#F8F7F4] text-[#8A877F]";
  return "border-[#E3E0D8] bg-white text-[#9B9892]";
}

function pct(value: number | null) {
  if (value === null) return "暂无";
  return `${Math.round(value * 100)}%`;
}

function cellCount(counts: TrackCalibrationCounts) {
  return counts.strong_pick + counts.maybe + counts.skip + counts.not_run + counts.not_covered;
}

function trackHref(trackId: string, date: string | null) {
  const params = new URLSearchParams({ track: trackId });
  if (date) params.set("date", date);
  return `/tracks?${params.toString()}`;
}

function StatCard({ label, value, tone = "plain" }: { label: string; value: string | number; tone?: "plain" | "green" | "yellow" | "muted" }) {
  const toneClass =
    tone === "green"
      ? "border-[#A9C682] bg-[#F2F8E9] text-[#36591C]"
      : tone === "yellow"
        ? "border-[#E1C58F] bg-[#FFF8EA] text-[#755019]"
        : tone === "muted"
          ? "border-[#D8D3CB] bg-[#F3F1EC] text-[#4A4A47]"
          : "border-[#D8D3CB] bg-white text-[#1F1F1E]";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function DecisionChip({ cell }: { cell: MatrixCell }) {
  return (
    <span
      className={`inline-flex min-w-16 justify-center rounded-full border px-2 py-1 text-xs font-medium ${toneFor(
        cell.status,
      )}`}
      title={cell.reason ?? labelFor(cell.status)}
    >
      {labelFor(cell.status)}
    </span>
  );
}

function DirectionCard({ row }: { row: DirectionCalibrationRow }) {
  return (
    <article className="rounded-lg border border-[#D8D3CB] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-snug text-[#1F1F1E]">{row.direction}</h2>
          <p className="mt-1 text-xs text-[#7A7770]">
            召回 {row.hotspots.length} 条热点 · skip 率 {pct(row.skipRate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 text-xs">
          <span className="rounded-full bg-[#F2F8E9] px-2 py-1 text-[#36591C]">必发 {row.counts.strong_pick}</span>
          <span className="rounded-full bg-[#FFF8EA] px-2 py-1 text-[#755019]">拍板 {row.counts.maybe}</span>
          <span className="rounded-full bg-[#F3F1EC] px-2 py-1 text-[#5B5852]">别蹭 {row.counts.skip}</span>
        </div>
      </div>

      {!row.hotspots.length ? (
        <div className="mt-3 rounded-md border border-dashed border-[#D8D3CB] bg-[#FAF9F7] p-3 text-sm text-[#6B6963]">
          这天未召回热点。
        </div>
      ) : null}
    </article>
  );
}

function HotspotRows({
  title,
  rows,
  date,
  empty,
  showSource = true,
}: {
  title: string;
  rows: TrackHotspotCalibration[];
  date: string | null;
  empty: string;
  showSource?: boolean;
}) {
  return (
    <section className="rounded-lg border border-[#D8D3CB] bg-white">
      <div className="border-b border-[#EEEAE2] px-4 py-3">
        <h2 className="text-base font-bold text-[#1F1F1E]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-[#F3F1EC] text-left text-xs text-[#6B6963]">
            <tr>
              <th className="w-[34%] px-4 py-3 font-medium">热点</th>
              <th className="px-3 py-3 font-medium">热度</th>
              {showSource ? <th className="px-3 py-3 font-medium">来源方向</th> : null}
              <th className="w-[28%] px-3 py-3 font-medium">问题维度</th>
              <th className="px-3 py-3 font-medium">同赛道账号判定</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.hotspot.hotspot_id} className="border-t border-[#EEEAE2] align-top">
                <td className="px-4 py-3">
                  <Link
                    href={`/hotspots/${row.hotspot.hotspot_id}${date ? `?date=${date}` : ""}`}
                    className="font-medium leading-snug text-[#2D5D8A] no-underline hover:underline"
                  >
                    {row.hotspot.title ?? row.hotspot.hotspot_id}
                  </Link>
                  <div className="mt-1 text-xs text-[#7A7770]">{row.hotspot.hotspot_id}</div>
                </td>
                <td className="px-3 py-3 tabular-nums">{row.hotspot.heat_score_10 ?? "未填"}</td>
                {showSource ? <td className="px-3 py-3 text-[#4A4A47]">{row.hotspot.source_direction ?? "未标记"}</td> : null}
                <td className="px-3 py-3 text-xs leading-relaxed text-[#5B5852]">
                  {row.hotspot.candidate_problem_dimensions?.length
                    ? row.hotspot.candidate_problem_dimensions.join("、")
                    : "未填"}
                </td>
                <td className="px-3 py-3">
                  {row.cells.length ? (
                    <div className="flex flex-wrap gap-1">
                      {row.cells.map((cell) => (
                        <DecisionChip key={cell.account_id} cell={cell} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[#8A877F]">该赛道暂无账号</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-4 py-6 text-sm text-[#7A7770]" colSpan={showSource ? 5 : 4}>
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function TracksPage({
  searchParams,
}: {
  searchParams?: { date?: string; track?: string };
}) {
  const snapshot = await buildTrackCalibrationSnapshot(searchParams?.date, searchParams?.track);
  const selectedTrack = snapshot.selectedTrack;
  const selectedTrackId = selectedTrack?.track_id ?? "";
  const allAssignedRows = snapshot.directionRows.flatMap((row) => row.hotspots);
  const showUnassigned = snapshot.directions.length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <DateContextBar
        date={snapshot.date}
        prevDate={snapshot.prevDate}
        nextDate={snapshot.nextDate}
        latestDate={snapshot.latestDate}
        basePath="/tracks"
        query={{ track: selectedTrackId }}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#7A7770]">赛道与母题</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">母题校准台</h1>
          <p className="mt-1 text-sm text-[#6B6963]">
            只读查看：每条母题当天召回了什么热点，以及同赛道账号怎么判。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {snapshot.tracks.map((track) => (
            <Link
              key={track.track_id}
              href={trackHref(track.track_id, snapshot.date)}
              className={`rounded-md border px-3 py-2 text-sm no-underline ${
                track.track_id === selectedTrackId
                  ? "border-[#1F1F1E] bg-[#1F1F1E] text-white"
                  : "border-[#B8B5AD] text-[#343330] hover:bg-[#F3F1EC]"
              }`}
            >
              {track.track_name ?? track.track_id}
            </Link>
          ))}
        </div>
      </div>

      {selectedTrack ? (
        <section className="mt-5 rounded-lg border border-[#D8D3CB] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1F1F1E]">{selectedTrack.track_name ?? selectedTrack.track_id}</h2>
              <p className="mt-1 text-xs text-[#7A7770]">{selectedTrack.track_id}</p>
            </div>
            <span className="rounded-full bg-[#F3F1EC] px-2 py-1 text-xs text-[#5B5852]">
              {selectedTrack ? `${selectedTrack.status === "approved" || selectedTrack.status === "reference" ? "已定稿" : "草稿·不跑批"} · ${snapshot.directions.length ? "有母题" : "待补母题"}` : "待补母题"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-md bg-[#FBFAF7] p-3">
              <div className="text-xs text-[#8A877F]">产品价值</div>
              <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">{selectedTrack.product_value ?? "未填"}</p>
            </div>
            <div className="rounded-md bg-[#FBFAF7] p-3">
              <div className="text-xs text-[#8A877F]">对外可用词</div>
              <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">
                {selectedTrack.external_vocab.join("、") || "未填"}
              </p>
            </div>
            <div className="rounded-md bg-[#FBFAF7] p-3">
              <div className="text-xs text-[#8A877F]">不能碰的词</div>
              <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">
                {selectedTrack.forbidden_terms.join("、") || "未填"}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-5 rounded-lg border border-dashed border-[#D8D3CB] bg-white p-6 text-sm text-[#6B6963]">
          没有找到赛道配置。
        </section>
      )}

      <section className="mt-5 grid gap-3 md:grid-cols-4 lg:grid-cols-8">
        <StatCard label="同赛道账号" value={snapshot.totals.accounts} />
        <StatCard label="母题" value={snapshot.totals.motifs} />
        <StatCard label="召回热点" value={snapshot.totals.recalledHotspots} />
        <StatCard label="未归入母题" value={snapshot.totals.unassignedHotspots} tone="muted" />
        <StatCard label="必发" value={snapshot.totals.strong_pick} tone="green" />
        <StatCard label="拍板" value={snapshot.totals.maybe} tone="yellow" />
        <StatCard label="别蹭" value={snapshot.totals.skip} tone="muted" />
        <StatCard label="未跑/未覆盖" value={`${snapshot.totals.not_run}/${snapshot.totals.not_covered}`} />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1E]">母题召回概览</h2>
            <p className="text-sm text-[#7A7770]">skip 率只按已经判定的热点计算，不把未跑批和未覆盖混进去。</p>
          </div>
          <div className="text-xs text-[#8A877F]">判定格数：{cellCount(snapshot.totals)}</div>
        </div>
        {snapshot.directions.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {snapshot.directionRows.map((row) => (
              <DirectionCard key={row.direction} row={row} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#D8D3CB] bg-white p-6 text-sm text-[#6B6963]">
            这个赛道的配置文件里还没有 bridge.search_directions，先显示“待补母题”。让 agent 走「赛道车间」起草，博士定稿后生效。
          </div>
        )}
      </section>

      <section className="mt-7 space-y-4">
        {snapshot.directionRows.map((row) => (
          <HotspotRows
            key={row.direction}
            title={`母题：${row.direction}`}
            rows={row.hotspots}
            date={snapshot.date}
            empty="这天未召回热点。"
            showSource={false}
          />
        ))}

        {showUnassigned ? (
          <HotspotRows
            title="未归入母题"
            rows={snapshot.unassignedHotspots}
            date={snapshot.date}
            empty="这天没有未归入母题的热点。"
          />
        ) : null}

        {!allAssignedRows.length && !showUnassigned && snapshot.selectedTrack ? (
          <div className="rounded-lg border border-dashed border-[#D8D3CB] bg-white p-6 text-sm text-[#6B6963]">
            待补母题后，这里会按母题展示召回热点。
          </div>
        ) : null}
      </section>
    </main>
  );
}
