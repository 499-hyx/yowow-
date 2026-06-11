import Link from "next/link";

import DateContextBar from "@/components/adaptation/DateContextBar";
import { buildDashboardSnapshot, type HotspotRecord } from "@/lib/dashboard-data";
import { displayList, displayText } from "@/lib/display-text";

export const dynamic = "force-dynamic";

function compactList(items?: string[]) {
  if (!items?.length) return "未填";
  return displayList(items).join("、");
}

function HotspotCard({ hotspot, date }: { hotspot: HotspotRecord; date: string | null }) {
  return (
    <article className="rounded-lg border border-[#D8D3CB] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/hotspots/${hotspot.hotspot_id}?date=${date ?? ""}`}
            className="text-base font-bold leading-snug text-[#1F1F1E] no-underline hover:underline"
          >
            {displayText(hotspot.title ?? hotspot.hotspot_id)}
          </Link>
          <p className="mt-2 text-sm leading-relaxed text-[#4A4A47]">{displayText(hotspot.summary ?? "暂无摘要。")}</p>
        </div>
        <div className="rounded-md border border-[#E8E6E1] bg-[#FAF9F7] px-3 py-2 text-right">
          <div className="text-xs text-[#8A877F]">热度</div>
          <div className="text-lg font-bold text-[#1F1F1E]">{hotspot.heat_score_10 ?? "未填"}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-md bg-[#FBFAF7] p-3">
          <div className="text-xs font-medium text-[#8A877F]">现象</div>
          <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">{displayText(hotspot.phenomenon ?? "未填")}</p>
        </div>
        <div className="rounded-md bg-[#FBFAF7] p-3">
          <div className="text-xs font-medium text-[#8A877F]">传播情绪</div>
          <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">{displayText(hotspot.spread_emotion ?? "未填")}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[#F3F1EC] px-2 py-1 text-[#5B5852]">
          来源方向：{displayText(hotspot.source_direction ?? "未标记")}
        </span>
        <span className="rounded-full bg-[#F3F1EC] px-2 py-1 text-[#5B5852]">
          平台：{compactList(hotspot.platforms)}
        </span>
      </div>
    </article>
  );
}

function groupLabel(scope: string, trackNames: Map<string, string>) {
  if (!scope.startsWith("track:")) return "大盘热点（全账号共享）";
  const trackId = scope.slice("track:".length);
  return `${trackNames.get(trackId) ?? trackId} · 赛道定向召回`;
}

export default async function HotspotsPage({ searchParams }: { searchParams?: { date?: string } }) {
  const snapshot = await buildDashboardSnapshot(searchParams?.date);

  const trackNames = new Map(
    snapshot.accounts
      .filter((a) => a.track_id)
      .map((a) => [a.track_id as string, a.track_name ?? (a.track_id as string)]),
  );
  const groups = new Map<string, typeof snapshot.hotspots>();
  for (const hotspot of snapshot.hotspots) {
    const scope = hotspot.scope ?? "broad";
    if (!groups.has(scope)) groups.set(scope, []);
    groups.get(scope)!.push(hotspot);
  }
  const orderedScopes = Array.from(groups.keys()).sort((a, b) =>
    a === "broad" ? -1 : b === "broad" ? 1 : a.localeCompare(b),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <DateContextBar
        date={snapshot.date}
        prevDate={snapshot.prevDate}
        nextDate={snapshot.nextDate}
        latestDate={snapshot.latestDate}
        basePath="/hotspots"
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#7A7770]">热点池</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">
            {snapshot.date ?? "暂无日期"} · 中立原料
          </h1>
          <p className="mt-1 text-sm text-[#6B6963]">
            这里先看事实、情绪和问题维度，不在热点池里预判该归哪个账号。
          </p>
        </div>
        <Link href={`/${snapshot.date ? `?date=${snapshot.date}` : ""}`} className="rounded-md border border-[#B8B5AD] px-3 py-2 text-sm text-[#343330] no-underline">
          回今日总览
        </Link>
      </div>

      {snapshot.hotspots.length ? (
        orderedScopes.map((scope) => (
          <section key={scope} className="mt-6">
            <h2 className="mb-3 text-sm font-bold text-[#5B5852]">
              {groupLabel(scope, trackNames)}
              <span className="ml-2 font-normal text-[#9B9892]">{groups.get(scope)!.length} 条</span>
            </h2>
            <div className="space-y-3">
              {groups.get(scope)!.map((hotspot) => (
                <HotspotCard key={hotspot.hotspot_id} hotspot={hotspot} date={snapshot.date} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-[#D8D3CB] bg-white p-6 text-sm text-[#6B6963]">
          没有找到热点池文件。公共池在 data/hotspots/，赛道池在 data/hotspots/tracks/赛道ID/。
        </div>
      )}
    </main>
  );
}
