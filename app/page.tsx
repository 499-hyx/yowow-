import Link from "next/link";

import CopyTextButton from "@/components/adaptation/CopyTextButton";
import DateContextBar from "@/components/adaptation/DateContextBar";
import type { AdaptationOutput, Recommendation } from "@/lib/adaptation-types";
import {
  buildDashboardSnapshot,
  hotspotSourceLabel,
  sourceLinkLabel,
  type AccountDayResult,
  type HotspotRecord,
  type MatrixCell,
} from "@/lib/dashboard-data";
import { displayText } from "@/lib/display-text";
import { getPipelineStatus, type PipelineStatusItem } from "@/lib/pipeline-status";
import { primaryDashboardAction, todayInShanghai } from "@/lib/pr6-state.mjs";

export const revalidate = 60;

function cnDate(date: string | null) {
  if (!date) return "暂无日期";
  const [, month, day] = date.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}

function labelFor(rec: MatrixCell["status"]) {
  if (rec === "strong_pick") return "必发";
  if (rec === "maybe") return "拍板";
  if (rec === "skip") return "别蹭";
  if (rec === "not_run") return "未跑批";
  if (rec === "out_of_scope") return "非本赛道";
  return "未覆盖";
}

function cellTone(rec: MatrixCell["status"]) {
  if (rec === "strong_pick") return "border-[#A9C682] bg-[#F2F8E9] text-[#36591C]";
  if (rec === "maybe") return "border-[#E1C58F] bg-[#FFF8EA] text-[#755019]";
  if (rec === "skip") return "border-[#D8D3CB] bg-[#F3F1EC] text-[#5B5852]";
  if (rec === "not_run") return "border-[#E3E0D8] bg-[#F8F7F4] text-[#8A877F]";
  if (rec === "out_of_scope") return "border-transparent bg-transparent text-[#C4C1BA]";
  return "border-[#E3E0D8] bg-white text-[#9B9892]";
}

function firstOutput(result: AccountDayResult, rec: Recommendation): AdaptationOutput | null {
  const board = result.response?.board;
  if (!board) return null;
  const all = [...board.picks, ...board.also_ran, ...board.skipped];
  return all.find((output) => output.recommendation === rec) ?? null;
}

function AccountRow({
  result,
  date,
  hotspotById,
}: {
  result: AccountDayResult;
  date: string | null;
  hotspotById: Map<string, HotspotRecord>;
}) {
  const strong = firstOutput(result, "strong_pick");
  const maybe = firstOutput(result, "maybe");
  const skipped = firstOutput(result, "skip");
  const lead = strong ?? maybe;
  const leadHotspot = lead ? hotspotById.get(lead.hotspot_id) : null;
  const leadSourceUrl = leadHotspot?.source_url ?? null;
  const leadSourceLabel = hotspotSourceLabel(leadHotspot);
  const reason = lead ? result.response?.meta?.[lead.hotspot_id]?.reason : null;
  const skipReason = skipped?.skip_reason ?? (skipped ? result.response?.meta?.[skipped.hotspot_id]?.reason : null);

  return (
    <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/account/${result.account.account_id}${date ? `?date=${date}` : ""}`}
            className="text-base font-bold text-[#1F1F1E] no-underline hover:underline"
          >
            {result.account.display_name}
          </Link>
          <div className="mt-0.5 text-xs text-[#7A7770]">
            {result.account.track_name ?? result.account.track_id} · {result.account.platform_name ?? result.account.platform_id}
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-[#F2F8E9] px-2 py-1 text-[#36591C]">必发 {result.counts.strong_pick}</span>
          <span className="rounded-full bg-[#FFF8EA] px-2 py-1 text-[#755019]">拍板 {result.counts.maybe}</span>
          <span className="rounded-full bg-[#F3F1EC] px-2 py-1 text-[#5B5852]">别蹭 {result.counts.skip}</span>
        </div>
      </div>

      {result.response ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
            <div className="text-xs font-medium text-[#8A877F]">今天发什么</div>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#1F1F1E]">
              {displayText(lead?.content?.title ?? (lead ? result.response.meta?.[lead.hotspot_id]?.oneLiner : "今天还没选出可发内容"))}
            </p>
            {leadSourceUrl ? (
              <a
                href={leadSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-[#2D5D8A] no-underline hover:underline"
              >
                查看{sourceLinkLabel(leadSourceUrl) === "聚合页" ? "聚合页" : "原素材"} ↗
              </a>
            ) : leadSourceLabel ? (
              <span className="mt-1 inline-block rounded-full bg-[#F3F1EC] px-2 py-0.5 text-xs text-[#5B5852]">
                {leadSourceLabel}
              </span>
            ) : null}
          </div>
          <div className="rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
            <div className="text-xs font-medium text-[#8A877F]">为什么能发</div>
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-[#4A4A47]">
              {displayText(reason ?? "这天没有可发推荐，先看别蹭原因。")}
            </p>
          </div>
          <div className="rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
            <div className="text-xs font-medium text-[#8A877F]">哪些别蹭</div>
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-[#4A4A47]">
              {displayText(skipReason ?? "暂无被跳过的热点。")}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-[#D8D3CB] bg-[#FAF9F7] p-3 text-sm text-[#6B6963]">
          今天还没跑批。该账号会在矩阵里显示未跑批。
        </div>
      )}
    </section>
  );
}

function MatrixBadge({ cell }: { cell: MatrixCell }) {
  return (
    <span
      className={`inline-flex min-w-16 justify-center rounded-full border px-2 py-1 text-xs font-medium ${cellTone(
        cell.status,
      )}`}
      title={displayText(cell.reason ?? labelFor(cell.status))}
    >
      {labelFor(cell.status)}
    </span>
  );
}

function PipelineStatusBar({ items }: { items: PipelineStatusItem[] }) {
  return (
    <section className="mb-5 rounded-lg border border-[#D8D3CB] bg-white px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-bold text-[#1F1F1E]">今日流水线</span>
        {items.map((item) => (
          <div key={item.key} className="flex flex-wrap items-center gap-1 rounded-md bg-[#FBFAF7] px-2 py-1 text-xs text-[#4A4A47]">
            <span className={item.status === "ok" ? "font-bold text-[#5C7A2E]" : "font-bold text-[#9A4A2F]"}>
              {item.status === "ok" ? "✓" : "✗"}
            </span>
            <span className="font-medium">{item.label}</span>
            <span className="text-[#7A7770]">{item.detail}</span>
            {item.command ? <CopyTextButton text={item.command} label="复制话术" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams?: { date?: string } }) {
  const snapshot = await buildDashboardSnapshot(searchParams?.date);
  const pipeline = getPipelineStatus(snapshot.date ?? undefined);
  const hotspotById = new Map(snapshot.hotspots.map((h) => [h.hotspot_id, h]));
  const primaryAction = primaryDashboardAction({
    accounts: snapshot.accounts,
    displayedDate: snapshot.date,
    today: todayInShanghai(),
  });
  const sparkHref = snapshot.accounts[0]
    ? `/account/${snapshot.accounts[0].account_id}${snapshot.date ? `?date=${snapshot.date}&tab=spark` : "?tab=spark"}`
    : "/onboarding";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <DateContextBar
        date={snapshot.date}
        prevDate={snapshot.prevDate}
        nextDate={snapshot.nextDate}
        latestDate={snapshot.latestDate}
        basePath="/"
      />
      <PipelineStatusBar items={pipeline.items} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#7A7770]">今日总览</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-[#1F1F1E]">
            {cnDate(snapshot.date)} · 内容决策快照
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {primaryAction.kind === "link" ? (
            <Link
              href={primaryAction.href ?? "/accounts"}
              className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-black"
            >
              {primaryAction.label}
            </Link>
          ) : (
            <CopyTextButton
              text={primaryAction.text ?? "所有账号今天发什么"}
              label={primaryAction.label}
              className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white hover:bg-black"
            />
          )}
          <Link
            href={sparkHref}
            className="rounded-md border border-[#B8B5AD] bg-white px-4 py-2 text-sm font-medium text-[#343330] no-underline hover:bg-[#F3F1EC]"
          >
            + 灵感
          </Link>
          <Link
            href="/onboarding"
            className="rounded-md border border-[#B8B5AD] bg-white px-4 py-2 text-sm font-medium text-[#343330] no-underline hover:bg-[#F3F1EC]"
          >
            新增账号
          </Link>
        </div>
      </div>

      <section className="mt-5 grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-[#D8D3CB] bg-white p-4">
          <div className="text-xs text-[#8A877F]">热点池</div>
          <div className="mt-1 text-2xl font-bold">{snapshot.totals.hotspots}</div>
        </div>
        <div className="rounded-lg border border-[#D8D3CB] bg-white p-4">
          <div className="text-xs text-[#8A877F]">账号</div>
          <div className="mt-1 text-2xl font-bold">{snapshot.totals.accounts}</div>
        </div>
        <div className="rounded-lg border border-[#A9C682] bg-[#F2F8E9] p-4">
          <div className="text-xs text-[#5E7E3E]">必发</div>
          <div className="mt-1 text-2xl font-bold text-[#36591C]">{snapshot.totals.strong}</div>
        </div>
        <div className="rounded-lg border border-[#E1C58F] bg-[#FFF8EA] p-4">
          <div className="text-xs text-[#8C6427]">待拍板</div>
          <div className="mt-1 text-2xl font-bold text-[#755019]">{snapshot.totals.maybe}</div>
        </div>
        <div className="rounded-lg border border-[#D8D3CB] bg-[#F3F1EC] p-4">
          <div className="text-xs text-[#6B6963]">别蹭</div>
          <div className="mt-1 text-2xl font-bold text-[#4A4A47]">{snapshot.totals.skipped}</div>
        </div>
      </section>

      {!snapshot.date ? (
        <section className="mt-6 rounded-lg border border-dashed border-[#D8D3CB] bg-white p-6 text-sm text-[#6B6963]">
          还没有热点池文件。先把热点保存到 `data/hotspots/YYYY-MM-DD.json`，再回到这里看总览。
        </section>
      ) : null}

      <section id="accounts" className="mt-7 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1F1F1E]">账号今日结论</h2>
          <Link href={`/accounts${snapshot.date ? `?date=${snapshot.date}` : ""}`} className="text-sm text-[#5C7A2E] no-underline hover:underline">
            查看全部账号
          </Link>
        </div>
        {snapshot.results.length ? (
          snapshot.results.map((result) => (
            <AccountRow key={result.account.account_id} result={result} date={snapshot.date} hotspotById={hotspotById} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[#D8D3CB] bg-white p-5 text-sm text-[#6B6963]">
            暂无账号。先新增账号或放入账号 JSON。
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1E]">同一批热点，各账号怎么判</h2>
            <p className="text-sm text-[#7A7770]">矩阵越分化，越能看出“赛道适配”而不是简单追热点。</p>
          </div>
          <Link href={`/hotspots${snapshot.date ? `?date=${snapshot.date}` : ""}`} className="text-sm text-[#5C7A2E] no-underline hover:underline">
            进入热点池
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#D8D3CB] bg-white">
          <table className="min-w-full table-fixed border-collapse text-sm">
            <thead className="bg-[#F3F1EC] text-left text-xs text-[#6B6963]">
              <tr>
                <th className="w-[42%] px-4 py-3 font-medium">热点</th>
                {snapshot.accounts.map((account) => (
                  <th key={account.account_id} className="px-3 py-3 font-medium">
                    {account.display_name.replace(" · ", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot.matrix.map((row) => (
                <tr key={row.hotspot.hotspot_id} className="border-t border-[#EEEAE2] align-top">
                  <td className="px-4 py-2">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/hotspots/${row.hotspot.hotspot_id}?date=${snapshot.date ?? ""}`}
                        className="min-w-0 truncate font-medium text-[#2D5D8A] no-underline hover:underline"
                        title={displayText(row.hotspot.title ?? row.hotspot.hotspot_id)}
                      >
                        {displayText(row.hotspot.title ?? row.hotspot.hotspot_id)}
                      </Link>
                      {row.hotspot.source_url ? (
                        <a
                          href={row.hotspot.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs text-[#2D5D8A] no-underline hover:underline"
                        >
                          {sourceLinkLabel(row.hotspot.source_url)} ↗
                        </a>
                      ) : hotspotSourceLabel(row.hotspot) ? (
                        <span className="shrink-0 rounded-full bg-[#F3F1EC] px-2 py-0.5 text-xs text-[#5B5852]">
                          {hotspotSourceLabel(row.hotspot)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-[#7A7770]" title={displayText(row.hotspot.summary ?? "")}>
                      热度 {row.hotspot.heat_score_10 ?? "未填"}
                      {row.hotspot.summary ? ` · ${displayText(row.hotspot.summary)}` : ""}
                    </div>
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.account_id} className="px-3 py-2">
                      <MatrixBadge cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
              {!snapshot.matrix.length ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-[#7A7770]" colSpan={snapshot.accounts.length + 1}>
                    这天没有热点池数据。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
