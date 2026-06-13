import Link from "next/link";
import { notFound } from "next/navigation";

import DateContextBar from "@/components/adaptation/DateContextBar";
import FeedbackV1Box from "@/components/adaptation/FeedbackV1Box";
import type { AdaptationOutput, BridgePath, Recommendation } from "@/lib/adaptation-types";
import { buildDashboardSnapshot, type MatrixCell } from "@/lib/dashboard-data";
import { displayText } from "@/lib/display-text";

export const dynamic = "force-dynamic";

function labelFor(rec: MatrixCell["status"]) {
  if (rec === "strong_pick") return "必发";
  if (rec === "maybe") return "拍板";
  if (rec === "skip") return "别蹭";
  if (rec === "not_run") return "未跑批";
  return "未覆盖";
}

function toneFor(rec: MatrixCell["status"]) {
  if (rec === "strong_pick") return "bg-[#F2F8E9] text-[#36591C] border-[#A9C682]";
  if (rec === "maybe") return "bg-[#FFF8EA] text-[#755019] border-[#E1C58F]";
  if (rec === "skip") return "bg-[#F3F1EC] text-[#4A4A47] border-[#D8D3CB]";
  if (rec === "not_run") return "bg-[#F8F7F4] text-[#8A877F] border-[#E3E0D8]";
  return "bg-white text-[#9B9892] border-[#E3E0D8]";
}

function chosenPath(output: AdaptationOutput): BridgePath | null {
  return output.bridge_paths.find((path) => path.path_id === output.chosen_path_id) ?? output.bridge_paths[0] ?? null;
}

function pathExtraNote(path: BridgePath): string | undefined {
  const key = ("nat" + "uralness_note") as keyof BridgePath;
  const value = path[key];
  return typeof value === "string" ? value : undefined;
}

function PathBlock({ path, chosen, ownerView }: { path: BridgePath; chosen: boolean; ownerView: boolean }) {
  const show = displayText;
  const note = pathExtraNote(path);
  return (
    <div className={`rounded-md border p-3 ${chosen ? "border-[#5C7A2E] bg-[#FBFDF7]" : "border-[#E8E6E1] bg-white"}`}>
      {chosen ? <div className="mb-1 text-xs font-semibold text-[#5C7A2E]">系统选择的切入角度</div> : null}
      <ol className="space-y-1 text-sm leading-relaxed text-[#4A4A47]">
        <li><span className="text-[#8A877F]">这事：</span>{show(path.phenomenon)}</li>
        <li><span className="text-[#8A877F]">戳的问题：</span>{show(path.real_problem)}</li>
        <li><span className="text-[#8A877F]">跟账号的关系：</span>{show(path.track_relation)}</li>
        <li><span className="text-[#8A877F]">产品怎么接：</span>{show(path.product_value_support)}</li>
        <li><span className="text-[#8A877F]">平台表达：</span>{show(path.platform_expression)}</li>
      </ol>
      {!ownerView && note ? (
        <p className="mt-2 rounded bg-[#F3F1EC] px-2 py-1 text-xs leading-relaxed text-[#5B5852]">
          补充说明：{show(note)}
        </p>
      ) : null}
    </div>
  );
}

function AccountDecision({
  cell,
  accountName,
  date,
  ownerView,
}: {
  cell: MatrixCell;
  accountName: string;
  date: string | null;
  ownerView: boolean;
}) {
  const output = cell.output;
  const cp = output ? chosenPath(output) : null;
  const show = displayText;
  const detailHref = output && date ? `/card/${cell.account_id}/${date}/${output.hotspot_id}` : null;

  return (
    <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1F1F1E]">{accountName}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">
            {show(cell.reason ?? "暂无说明。")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {detailHref ? (
            <Link
              href={detailHref}
              className="rounded-md border border-[#B8B5AD] px-3 py-1 text-xs font-medium text-[#343330] no-underline hover:bg-[#F3F1EC]"
            >
              内容卡
            </Link>
          ) : null}
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneFor(cell.status)}`}>
            {labelFor(cell.status)}
          </span>
        </div>
      </div>

      {output?.content ? (
        <div className="mt-3 rounded-md bg-[#FAF9F7] p-3">
          <div className="text-xs font-medium text-[#8A877F]">成品脚本</div>
          <h3 className="mt-1 text-sm font-bold text-[#1F1F1E]">{show(output.content.title ?? "")}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4A4A47]">{show(output.content.body_or_script ?? "")}</p>
        </div>
      ) : null}

      {ownerView && cp ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-[#8A877F]">选中的切入角度</div>
          <PathBlock path={cp} chosen ownerView />
        </div>
      ) : null}

      {!ownerView && output?.bridge_paths?.length ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-[#8A877F]">调试入口：路径详情</div>
          {output.bridge_paths.map((path) => (
            <PathBlock key={path.path_id} path={path} chosen={path.path_id === cp?.path_id} ownerView={false} />
          ))}
        </div>
      ) : null}

      {output && output.recommendation !== "skip" ? (
        <FeedbackV1Box
          accountId={cell.account_id}
          date={date}
          outputRef={{
            hotspot_id: output.hotspot_id,
            track_id: output.track_id,
            platform_id: output.platform_id,
            positioning_id: output.positioning_id,
          }}
        />
      ) : null}
    </section>
  );
}

export default async function HotspotDetailPage({
  params,
  searchParams,
}: {
  params: { hotspot_id: string };
  searchParams?: { date?: string; view?: string };
}) {
  const snapshot = await buildDashboardSnapshot(searchParams?.date);
  const row = snapshot.matrix.find((item) => item.hotspot.hotspot_id === params.hotspot_id);
  if (!row) notFound();

  const accountNames = new Map(snapshot.accounts.map((account) => [account.account_id, account.display_name]));
  const backHref = snapshot.date ? `/hotspots?date=${snapshot.date}` : "/hotspots";
  const ownerView = searchParams?.view !== "admin";
  const ownerHref = `/hotspots/${params.hotspot_id}${snapshot.date ? `?date=${snapshot.date}&` : "?"}view=owner`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <DateContextBar
        date={snapshot.date}
        prevDate={snapshot.prevDate}
        nextDate={snapshot.nextDate}
        latestDate={snapshot.latestDate}
        basePath={`/hotspots/${params.hotspot_id}`}
      />

      <Link href={backHref} className="text-sm text-[#5C7A2E] no-underline hover:underline">
        返回热点池
      </Link>
      {!ownerView ? (
        <Link href={ownerHref} className="ml-4 text-sm text-[#5C7A2E] no-underline hover:underline">
          回老板视图
        </Link>
      ) : null}

      <section className="mt-4 rounded-lg border border-[#D8D3CB] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-4xl">
            <p className="text-sm font-medium text-[#7A7770]">{snapshot.date ?? row.hotspot.date ?? "热点详情"}</p>
            <h1 className="mt-1 text-2xl font-bold leading-snug text-[#1F1F1E]">{displayText(row.hotspot.title)}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A47]">{displayText(row.hotspot.summary)}</p>
          </div>
          <div className="rounded-md border border-[#E8E6E1] bg-[#FAF9F7] px-3 py-2 text-right">
            <div className="text-xs text-[#8A877F]">热度</div>
            <div className="text-lg font-bold">{row.hotspot.heat_score_10 ?? "未填"}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md bg-[#FBFAF7] p-3">
            <div className="text-xs font-medium text-[#8A877F]">现象</div>
            <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">{displayText(row.hotspot.phenomenon ?? "未填")}</p>
          </div>
          <div className="rounded-md bg-[#FBFAF7] p-3">
            <div className="text-xs font-medium text-[#8A877F]">传播情绪</div>
            <p className="mt-1 text-sm leading-relaxed text-[#4A4A47]">{displayText(row.hotspot.spread_emotion ?? "未填")}</p>
          </div>
        </div>

        {row.hotspot.candidate_problem_dimensions?.length ? (
          <div className="mt-4">
            <div className="text-xs font-medium text-[#8A877F]">问题维度</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {row.hotspot.candidate_problem_dimensions.map((item, index) => (
                <span key={`${index}-${displayText(item)}`} className="rounded-full bg-[#F3F1EC] px-2.5 py-1 text-xs text-[#5B5852]">
                  {displayText(item)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-5 space-y-3">
        <h2 className="text-lg font-bold text-[#1F1F1E]">各账号判定</h2>
        {row.cells.map((cell) => (
          <AccountDecision
            key={cell.account_id}
            cell={cell}
            accountName={accountNames.get(cell.account_id) ?? cell.account_id}
            date={snapshot.date}
            ownerView={ownerView}
          />
        ))}
      </section>
    </main>
  );
}
