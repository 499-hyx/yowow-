import Link from "next/link";
import { notFound } from "next/navigation";

import CopyTextButton from "@/components/adaptation/CopyTextButton";
import FeedbackV1Box from "@/components/adaptation/FeedbackV1Box";
import type { AdaptationOutput, BridgePath, Recommendation } from "@/lib/adaptation-types";
import { findOutput, loadHotspots, loadTodayForDate } from "@/lib/dashboard-data";
import { displayText } from "@/lib/display-text";
import { loadDataAccount } from "@/lib/file-data";

export const revalidate = 60;

function labelFor(recommendation: Recommendation) {
  if (recommendation === "strong_pick") return "必发";
  if (recommendation === "maybe") return "拍板";
  return "别蹭";
}

function toneFor(recommendation: Recommendation) {
  if (recommendation === "strong_pick") return "border-[#A9C682] bg-[#F2F8E9] text-[#36591C]";
  if (recommendation === "maybe") return "border-[#E1C58F] bg-[#FFF8EA] text-[#755019]";
  return "border-[#D8D3CB] bg-[#F3F1EC] text-[#4A4A47]";
}

function chosenPath(output: AdaptationOutput): BridgePath | null {
  return output.bridge_paths.find((path) => path.path_id === output.chosen_path_id) ?? output.bridge_paths[0] ?? null;
}

function cardHref(accountId: string, date: string, hotspotId: string, view: "owner" | "admin") {
  return `/card/${accountId}/${date}/${hotspotId}?view=${view}`;
}

function PathBlock({ path, chosen, ownerView }: { path: BridgePath; chosen: boolean; ownerView: boolean }) {
  const show = ownerView ? displayText : (value: string) => value;
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
      {!ownerView && path.naturalness_note ? (
        <p className="mt-2 rounded bg-[#F3F1EC] px-2 py-1 text-xs leading-relaxed text-[#5B5852]">
          后台说明：{path.naturalness_note}
        </p>
      ) : null}
    </div>
  );
}

export default async function CardDetailPage({
  params,
  searchParams,
}: {
  params: { account_id: string; date: string; hotspot_id: string };
  searchParams?: { view?: string };
}) {
  const account = await loadDataAccount(params.account_id);
  const response = await loadTodayForDate(params.account_id, params.date);
  const output = findOutput(response, params.hotspot_id);
  if (!account || !response || !output) notFound();

  const { hotspots } = await loadHotspots(params.date);
  const hotspot = hotspots.find((item) => item.hotspot_id === params.hotspot_id) ?? null;
  const meta = response.meta?.[params.hotspot_id];
  const ownerView = searchParams?.view !== "admin";
  const selectedPath = chosenPath(output);
  const script = output.content?.body_or_script ?? "";
  const title = output.content?.title ?? meta?.oneLiner ?? hotspot?.title ?? output.hotspot_id;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/account/${account.account_id}?date=${params.date}`} className="text-[#5C7A2E] no-underline hover:underline">
          返回账号
        </Link>
        <Link href={`/hotspots/${params.hotspot_id}?date=${params.date}`} className="text-[#5C7A2E] no-underline hover:underline">
          查看热点
        </Link>
        <Link
          href={cardHref(account.account_id, params.date, params.hotspot_id, ownerView ? "admin" : "owner")}
          className="text-[#5C7A2E] no-underline hover:underline"
        >
          {ownerView ? "打开后台视图" : "回老板视图"}
        </Link>
      </div>

      <section className="mt-4 rounded-lg border border-[#D8D3CB] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-[#7A7770]">
              {params.date} · {account.display_name}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-snug text-[#1F1F1E]">{ownerView ? displayText(title) : title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A47]">
              {ownerView
                ? displayText(meta?.reason ?? output.skip_reason ?? "暂无说明。")
                : (meta?.reason ?? output.skip_reason ?? "暂无说明。")}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneFor(output.recommendation)}`}>
            {labelFor(output.recommendation)}
          </span>
        </div>
      </section>

      {hotspot ? (
        <section className="mt-4 rounded-lg border border-[#D8D3CB] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#8A877F]">热点原文</div>
              <h2 className="mt-1 text-base font-bold text-[#1F1F1E]">{ownerView ? displayText(hotspot.title) : hotspot.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#4A4A47]">{ownerView ? displayText(hotspot.summary) : hotspot.summary}</p>
            </div>
            <div className="rounded-md border border-[#E8E6E1] bg-[#FAF9F7] px-3 py-2 text-right">
              <div className="text-xs text-[#8A877F]">热度</div>
              <div className="text-lg font-bold">{hotspot.heat_score_10 ?? "未填"}</div>
            </div>
          </div>
        </section>
      ) : null}

      {output.content ? (
        <section className="mt-4 rounded-lg border border-[#D8D3CB] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#8A877F]">成品脚本</div>
              <h2 className="mt-1 text-base font-bold text-[#1F1F1E]">{ownerView ? displayText(output.content.title) : output.content.title}</h2>
            </div>
            {script ? <CopyTextButton text={script} /> : null}
          </div>
          {script ? (
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-[#FAF9F7] p-3 text-sm leading-relaxed text-[#4A4A47]">
              {ownerView ? displayText(script) : script}
            </p>
          ) : null}
        </section>
      ) : null}

      {ownerView && selectedPath ? (
        <section className="mt-4 rounded-lg border border-[#D8D3CB] bg-white p-4">
          <div className="mb-2 text-xs font-medium text-[#8A877F]">为什么能发 · 完整分析</div>
          <PathBlock path={selectedPath} chosen ownerView />
        </section>
      ) : null}

      {output.risk_note ? (
        <section className="mt-4 rounded-lg border border-[#E1C58F] bg-[#FFF8EA] p-4">
          <div className="text-xs font-medium text-[#8C6427]">⚠ 发布前提醒</div>
          <p className="mt-1 text-sm leading-relaxed text-[#755019]">
            {ownerView ? displayText(output.risk_note) : output.risk_note}
          </p>
        </section>
      ) : null}

      {!ownerView && output.bridge_paths.length ? (
        <section className="mt-4 rounded-lg border border-[#D8D3CB] bg-white p-4">
          <div className="mb-2 text-xs font-medium text-[#8A877F]">后台视图：完整路径</div>
          <div className="space-y-2">
            {output.bridge_paths.map((path) => (
              <PathBlock key={path.path_id} path={path} chosen={path.path_id === selectedPath?.path_id} ownerView={false} />
            ))}
          </div>
        </section>
      ) : null}

      {output.recommendation !== "skip" ? (
        <FeedbackV1Box
          accountId={account.account_id}
          date={params.date}
          outputRef={{
            hotspot_id: output.hotspot_id,
            track_id: output.track_id,
            platform_id: output.platform_id,
            positioning_id: output.positioning_id,
          }}
        />
      ) : null}
    </main>
  );
}
