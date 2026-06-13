import Link from "next/link";
import { notFound } from "next/navigation";

import DateContextBar from "@/components/adaptation/DateContextBar";
import FeedbackV1Box from "@/components/adaptation/FeedbackV1Box";
import MemoryEditor from "@/components/adaptation/MemoryEditor";
import SparkInbox from "@/components/adaptation/SparkInbox";
import type { AdaptationOutput, BridgePath } from "@/lib/adaptation-types";
import {
  hotspotSourceLabel,
  isAggregatorUrl,
  loadAccountWorkbench,
  sourceLinkLabel,
  type HotspotRecord,
} from "@/lib/dashboard-data";
import { displayList, displayText } from "@/lib/display-text";
import { memoryCompleteness } from "@/lib/memory-meta";
import { withPerfSpan } from "@/lib/perf-log";
import { memoryEditMode, sparkInputMode } from "@/lib/pr6-state.mjs";
import { tursoEnabled } from "@/lib/turso";

export const revalidate = 60;

function listText(items?: string[]) {
  return items?.length ? displayList(items).join("、") : "未填";
}

type AccountTab = "today" | "memory" | "spark" | "history";

const TAB_LABELS: Record<AccountTab, string> = {
  today: "今日推荐",
  memory: "账号记忆",
  spark: "灵感收件箱",
  history: "历史与反馈",
};

function normalizeTab(value?: string): AccountTab {
  return value === "memory" || value === "spark" || value === "history" ? value : "today";
}

function accountTabHref(accountId: string, tab: AccountTab, date?: string | null, view?: string) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (date) params.set("date", date);
  if (view) params.set("view", view);
  return `/account/${accountId}?${params.toString()}`;
}

function MemoryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
      <div className="text-xs font-medium text-[#8A877F]">{label}</div>
      <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">{value}</p>
    </div>
  );
}

function chosenPath(output: AdaptationOutput) {
  return output.bridge_paths.find((path) => path.path_id === output.chosen_path_id) ?? output.bridge_paths[0] ?? null;
}

function pathExtraNote(path: BridgePath): string | undefined {
  const key = ("nat" + "uralness_note") as keyof BridgePath;
  const value = path[key];
  return typeof value === "string" ? value : undefined;
}

function OutputCard({
  output,
  reason,
  date,
  accountId,
  ownerView,
  hotspot,
}: {
  output: AdaptationOutput;
  reason?: string;
  date: string | null;
  accountId: string;
  ownerView: boolean;
  hotspot?: HotspotRecord | null;
}) {
  const isSkip = output.recommendation === "skip";
  const tone = isSkip
    ? "border-[#D8D3CB] bg-[#F3F1EC]"
    : output.recommendation === "maybe"
      ? "border-[#E1C58F] bg-[#FFF8EA]"
      : "border-[#A9C682] bg-[#F2F8E9]";
  const label = isSkip ? "别蹭" : output.recommendation === "maybe" ? "拍板" : "必发";
  const detailHref = date ? `/card/${accountId}/${date}/${output.hotspot_id}` : null;
  const sourceLabel = hotspotSourceLabel(hotspot);

  return (
    <details id={`card-${output.hotspot_id}`} open={output.recommendation === "strong_pick"} className={`scroll-mt-4 rounded-lg border p-4 ${tone}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/hotspots/${output.hotspot_id}${date ? `?date=${date}` : ""}`}
              className="text-sm font-bold text-[#1F1F1E] no-underline hover:underline"
            >
              {displayText(output.content?.title ?? hotspot?.title ?? output.hotspot_id)}
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-[#4A4A47]">{displayText(reason ?? output.skip_reason ?? "暂无说明。")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detailHref ? (
              <Link
                href={detailHref}
                className="rounded-md border border-[#B8B5AD] bg-white/75 px-2 py-1 text-xs font-medium text-[#343330] no-underline hover:bg-white"
              >
                内容卡
              </Link>
            ) : null}
            <span className="rounded-full bg-white/75 px-2 py-1 text-xs font-medium text-[#343330]">{label}</span>
          </div>
        </div>
      </summary>
      {hotspot ? (
        <div className="mt-3 rounded-md border border-[#E8E6E1] bg-white/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#8A877F]">原素材 · 这条推荐基于的真实报道</span>
            {hotspot.source_url ? (
              <a
                href={hotspot.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-[#B8B5AD] bg-white px-2 py-0.5 text-xs font-medium text-[#2D5D8A] no-underline hover:bg-[#F3F1EC]"
              >
                {isAggregatorUrl(hotspot.source_url) ? "查看聚合页（非具体报道）" : "查看原报道"} ↗
              </a>
            ) : sourceLabel ? (
              <span className="rounded-md border border-[#B8B5AD] bg-white px-2 py-0.5 text-xs font-medium text-[#5B5852]">
                {sourceLabel}
              </span>
            ) : (
              <span className="text-xs text-[#9B9892]">暂无原文链接</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium leading-snug text-[#1F1F1E]">{displayText(hotspot.title ?? "")}</p>
          {hotspot.summary ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6B6963]" title={displayText(hotspot.summary)}>
              {displayText(hotspot.summary)}
            </p>
          ) : null}
          <div className="mt-1.5 text-xs text-[#9B9892]">
            热度 {hotspot.heat_score_10 ?? "未填"}
            {hotspot.platforms?.length ? ` · ${displayList(hotspot.platforms).join("、")}` : ""}
            {hotspot.source_direction && hotspot.source_direction !== "broad" ? ` · 召回方向：${displayText(hotspot.source_direction)}` : ""}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-[#D8D3CB] bg-white/50 p-2.5 text-xs text-[#9B9892]">
          当天素材池中未找到这条热点的原始素材（多见于旧数据），无法展示证据来源。
        </div>
      )}

      {output.content?.body_or_script ? (
        <details className="mt-3 rounded-md bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-medium text-[#5C7A2E]">展开脚本</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4A4A47]">{displayText(output.content.body_or_script)}</p>
        </details>
      ) : null}

      {!isSkip && ownerView && chosenPath(output) ? (
        <div className="mt-3 rounded-md bg-white/70 p-3">
          <div className="text-xs font-medium text-[#8A877F]">分析（看完整版进内容卡）</div>
          <ul className="mt-1 space-y-1 text-sm leading-relaxed text-[#4A4A47]">
            <li>
              <span className="text-[#8A877F]">它暴露的现实：</span>
              {displayText(chosenPath(output)?.real_problem ?? "")}
            </li>
            <li>
              <span className="text-[#8A877F]">跟你号的关系：</span>
              {displayText(chosenPath(output)?.track_relation ?? "")}
            </li>
            <li>
              <span className="text-[#8A877F]">产品怎么接：</span>
              {displayText(chosenPath(output)?.product_value_support ?? "")}
            </li>
          </ul>
          {output.risk_note ? (
            <p className="mt-2 rounded bg-[#FFF8EA] px-2 py-1 text-xs leading-relaxed text-[#755019]">
              ⚠ {displayText(output.risk_note)}
            </p>
          ) : null}
        </div>
      ) : null}

      {!ownerView && output.bridge_paths.length ? (
        <details open className="mt-3 rounded-md bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-medium text-[#5C7A2E]">调试入口：路径详情</summary>
          <div className="mt-2 space-y-2">
            {output.bridge_paths.map((path) => (
              <div key={path.path_id} className="rounded-md border border-[#E8E6E1] bg-white p-3">
                <div className="text-xs font-semibold text-[#6B6963]">
                  {path.path_id === output.chosen_path_id ? "系统选择" : path.path_id}
                </div>
                <ol className="mt-1 space-y-1 text-sm leading-relaxed text-[#4A4A47]">
                  <li>1. {displayText(path.phenomenon)}</li>
                  <li>2. {displayText(path.real_problem)}</li>
                  <li>3. {displayText(path.track_relation)}</li>
                  <li>4. {displayText(path.product_value_support)}</li>
                  <li>5. {displayText(path.platform_expression)}</li>
                </ol>
                {pathExtraNote(path) ? (
                  <p className="mt-2 rounded bg-[#F3F1EC] px-2 py-1 text-xs text-[#5B5852]">
                    补充说明：{displayText(pathExtraNote(path))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {!isSkip ? (
        <FeedbackV1Box
          accountId={accountId}
          date={date}
          outputRef={{
            hotspot_id: output.hotspot_id,
            track_id: output.track_id,
            platform_id: output.platform_id,
            positioning_id: output.positioning_id,
          }}
        />
      ) : null}
    </details>
  );
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: { account_id: string };
  searchParams?: { date?: string; tab?: string; view?: string };
}) {
  return withPerfSpan(`account:${params.account_id}:${normalizeTab(searchParams?.tab)}`, async () => {
  const selectedTab = normalizeTab(searchParams?.tab);
  const {
    account,
    date,
    dateContext,
    response,
    runExists,
    counts,
    history,
    hotspots,
    trackDoc,
  } = await loadAccountWorkbench(params.account_id, searchParams?.date, {
    includeToday: selectedTab === "today",
    includeHotspots: selectedTab === "today",
    includeHistory: selectedTab === "history",
    includeTrackConfig: selectedTab === "memory",
    includeRunStatus: selectedTab !== "today",
  });
  if (!account) notFound();
  const hotspotById = new Map(hotspots.map((h) => [h.hotspot_id, h]));
  // B档定版：搜索母题来自赛道文件（唯一来源），不再读账号记忆副本
  const trackDirections: string[] = Array.isArray(trackDoc?.bridge?.search_directions)
    ? trackDoc.bridge.search_directions.filter((d: unknown): d is string => typeof d === "string")
    : [];
  const ownerView = searchParams?.view !== "admin";
  const completeness = memoryCompleteness(account.memory);
  const onlineDataMode = tursoEnabled();
  const memoryMode = memoryEditMode({ tursoEnabled: onlineDataMode });
  const sparkMode = sparkInputMode({ tursoEnabled: onlineDataMode });

  const outputs = response
    ? [...response.board.picks, ...response.board.also_ran, ...response.board.skipped]
    : [];
  const forbidden = Array.from(new Set([
    ...(account.memory.extra_forbidden_terms ?? []),
    ...(account.memory.understood?.forbidden_terms ?? []),
  ]));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <DateContextBar
        date={dateContext.date}
        prevDate={dateContext.prevDate}
        nextDate={dateContext.nextDate}
        latestDate={dateContext.latestDate}
        basePath={`/account/${account.account_id}`}
        query={{ tab: selectedTab, view: ownerView ? undefined : "admin" }}
      />

      <section className="rounded-lg border border-[#D8D3CB] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/accounts${date ? `?date=${date}` : ""}`} className="text-sm text-[#5C7A2E] no-underline hover:underline">
              返回账号列表
            </Link>
            <p className="text-sm font-medium text-[#7A7770]">账号主页</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">{account.display_name}</h1>
            <p className="mt-1 text-sm text-[#6B6963]">
              {account.track_name ?? account.track_id} · {account.platform_name ?? account.platform_id} ·{" "}
              {account.positioning_name ?? account.positioning_id}
            </p>
          </div>
          <div className="min-w-[220px] rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
            <div className="flex items-center gap-2 text-xs text-[#6B6963]">
              <span className={`h-2.5 w-2.5 rounded-full ${runExists ? "bg-[#5C7A2E]" : "bg-[#C9A24B]"}`} />
              {runExists ? "今天已跑批" : "今天未跑批"}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded bg-[#E8E6E1]">
                <div className="h-full rounded bg-[#5C7A2E]" style={{ width: `${completeness.percent}%` }} />
              </div>
              <span className="text-xs text-[#6B6963]">{completeness.filled}/{completeness.total}</span>
            </div>
            {!ownerView ? (
              <Link href={accountTabHref(account.account_id, selectedTab, date, "owner")} className="mt-2 inline-block text-xs text-[#5C7A2E] no-underline hover:underline">
                回老板视图
              </Link>
            ) : null}
          </div>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2 border-t border-[#EEEAE2] pt-4" aria-label="账号专栏">
          {(Object.keys(TAB_LABELS) as AccountTab[]).map((tab) => (
            <Link
              key={tab}
              href={accountTabHref(account.account_id, tab, date, ownerView ? undefined : "admin")}
              className={`rounded-md px-3 py-2 text-sm font-medium no-underline ${
                selectedTab === tab
                  ? "bg-[#1F1F1E] text-white"
                  : "border border-[#D8D3CB] bg-white text-[#343330] hover:bg-[#F3F1EC]"
              }`}
            >
              {TAB_LABELS[tab]}
            </Link>
          ))}
        </nav>
      </section>

      {selectedTab === "today" ? (
      <section className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1F1F1E]">{date ?? "今日"} 推荐</h2>
            <p className="text-sm text-[#7A7770]">
              {response
                ? `${counts.strong_pick} 必发 / ${counts.maybe} 待拍板 / ${counts.skip} 别蹭`
                : "今天还没跑批。"}
            </p>
          </div>
        </div>

        {outputs.length ? (
          <div className="mt-3 divide-y divide-[#EEEAE2] rounded-lg border border-[#D8D3CB] bg-white">
            {outputs.map((output) => {
              const hotspot = hotspotById.get(output.hotspot_id);
              const isSkip = output.recommendation === "skip";
              const rowLabel = isSkip ? "别蹭" : output.recommendation === "maybe" ? "拍板" : "必发";
              const rowTone = isSkip
                ? "bg-[#F3F1EC] text-[#5B5852]"
                : output.recommendation === "maybe"
                  ? "bg-[#FFF8EA] text-[#755019]"
                  : "bg-[#F2F8E9] text-[#36591C]";
              const rowTitle = output.content?.title ?? hotspot?.title ?? output.hotspot_id;
              const rowNote = response?.meta?.[output.hotspot_id]?.reason ?? output.skip_reason ?? "";
              const sourceLabel = hotspotSourceLabel(hotspot);
              return (
                <div key={output.hotspot_id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[#FBFAF7]">
                  <span className={`w-10 shrink-0 rounded-full px-1.5 py-0.5 text-center text-xs font-medium ${rowTone}`}>
                    {rowLabel}
                  </span>
                  <a
                    href={`#card-${output.hotspot_id}`}
                    className="min-w-0 shrink-0 basis-2/5 truncate font-medium text-[#1F1F1E] no-underline hover:underline"
                    title={displayText(rowTitle)}
                  >
                    {displayText(rowTitle)}
                  </a>
                  <span className="min-w-0 flex-1 truncate text-xs text-[#7A7770]" title={displayText(rowNote)}>
                    {displayText(rowNote)}
                  </span>
                  {hotspot?.source_url ? (
                    <a
                      href={hotspot.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-[#2D5D8A] no-underline hover:underline"
                    >
                      {sourceLinkLabel(hotspot.source_url)} ↗
                    </a>
                  ) : sourceLabel ? (
                    <span className="shrink-0 text-xs text-[#7A7770]">{sourceLabel}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="mt-3 space-y-3">
          {outputs.length ? (
            outputs.map((output) => (
              <OutputCard
                key={output.hotspot_id}
                output={output}
                date={date}
                accountId={account.account_id}
                ownerView={ownerView}
                reason={response?.meta?.[output.hotspot_id]?.reason}
                hotspot={hotspotById.get(output.hotspot_id)}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#D8D3CB] bg-white p-5 text-sm text-[#6B6963]">
              这个账号在所选日期没有安装推荐结果。
            </div>
          )}
        </div>
      </section>
      ) : null}

      {selectedTab === "memory" ? (
      <section className="mt-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1E]">账号记忆</h2>
          <p className="text-sm text-[#7A7770]">这些信息决定每天怎么筛热点、怎么写口吻、哪些内容直接拦下。</p>
        </div>
        <MemoryEditor
          accountId={account.account_id}
          initialMemory={account.memory}
          readOnly={!memoryMode.editable}
          readOnlyMessage={memoryMode.message}
        />

        <div className="rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
          <div className="text-xs font-medium text-[#8A877F]">搜索母题（来自赛道，改动找管理员走"重写搜索方向"）</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(trackDirections.length ? trackDirections : ["该赛道暂未配置搜索母题"]).map((item, index) => (
              <span key={`${index}-${displayText(item)}`} className="rounded-full bg-white px-2.5 py-1 text-xs text-[#4A4A47]">
                {displayText(item)}
              </span>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {selectedTab === "spark" ? (
      <section className="mt-7">
        <div className="mb-4 rounded-lg border border-dashed border-[#D8D3CB] bg-white p-5">
          <h2 className="text-lg font-bold text-[#1F1F1E]">灵感收件箱</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#6B6963]">
            {sparkMode.description}
          </p>
        </div>
        <SparkInbox
          accountId={account.account_id}
          accountName={account.display_name}
          readOnly={!sparkMode.submittable}
          readOnlyDescription={sparkMode.description}
        />
      </section>
      ) : null}

      {selectedTab === "history" ? (
      <section className="mt-7">
        <h2 className="text-lg font-bold text-[#1F1F1E]">历史摘要</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-[#D8D3CB] bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#F3F1EC] text-left text-xs text-[#6B6963]">
              <tr>
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">必发</th>
                <th className="px-4 py-3 font-medium">待拍板</th>
                <th className="px-4 py-3 font-medium">别蹭</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.date} className="border-t border-[#EEEAE2]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/account/${account.account_id}?date=${row.date}`}
                      className="font-medium text-[#2D5D8A] no-underline hover:underline"
                    >
                      {row.date}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.strong}</td>
                  <td className="px-4 py-3">{row.maybe}</td>
                  <td className="px-4 py-3">{row.skipped}</td>
                </tr>
              ))}
              {!history.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-[#7A7770]">
                    还没有历史归档。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </main>
  );
  });
}
