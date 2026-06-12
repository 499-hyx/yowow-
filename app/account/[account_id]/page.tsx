import Link from "next/link";
import { notFound } from "next/navigation";

import DateContextBar from "@/components/adaptation/DateContextBar";
import FeedbackV1Box from "@/components/adaptation/FeedbackV1Box";
import type { AdaptationOutput } from "@/lib/adaptation-types";
import { loadAccountWorkbench, resolveDateContext } from "@/lib/dashboard-data";
import { getDoc } from "@/lib/data-source";
import { displayList, displayText } from "@/lib/display-text";

export const revalidate = 60;

function listText(items?: string[]) {
  return items?.length ? displayList(items).join("、") : "未填";
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

function OutputCard({
  output,
  reason,
  date,
  accountId,
  ownerView,
}: {
  output: AdaptationOutput;
  reason?: string;
  date: string | null;
  accountId: string;
  ownerView: boolean;
}) {
  const isSkip = output.recommendation === "skip";
  const tone = isSkip
    ? "border-[#D8D3CB] bg-[#F3F1EC]"
    : output.recommendation === "maybe"
      ? "border-[#E1C58F] bg-[#FFF8EA]"
      : "border-[#A9C682] bg-[#F2F8E9]";
  const label = isSkip ? "别蹭" : output.recommendation === "maybe" ? "拍板" : "必发";
  const detailHref = date ? `/card/${accountId}/${date}/${output.hotspot_id}` : null;

  return (
    <article className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/hotspots/${output.hotspot_id}${date ? `?date=${date}` : ""}`}
            className="text-sm font-bold text-[#1F1F1E] no-underline hover:underline"
          >
            {displayText(output.content?.title ?? output.hotspot_id)}
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
          <summary className="cursor-pointer text-xs font-medium text-[#5C7A2E]">后台视图：完整路径</summary>
          <div className="mt-2 space-y-2">
            {output.bridge_paths.map((path) => (
              <div key={path.path_id} className="rounded-md border border-[#E8E6E1] bg-white p-3">
                <div className="text-xs font-semibold text-[#6B6963]">
                  {path.path_id === output.chosen_path_id ? "系统选择" : path.path_id}
                </div>
                <ol className="mt-1 space-y-1 text-sm leading-relaxed text-[#4A4A47]">
                  <li>1. {path.phenomenon}</li>
                  <li>2. {path.real_problem}</li>
                  <li>3. {path.track_relation}</li>
                  <li>4. {path.product_value_support}</li>
                  <li>5. {path.platform_expression}</li>
                </ol>
                {path.naturalness_note ? (
                  <p className="mt-2 rounded bg-[#F3F1EC] px-2 py-1 text-xs text-[#5B5852]">
                    后台说明：{path.naturalness_note}
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
    </article>
  );
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: { account_id: string };
  searchParams?: { date?: string; view?: string };
}) {
  const { account, date, response, counts, history } = await loadAccountWorkbench(params.account_id, searchParams?.date);
  if (!account) notFound();
  const dateContext = await resolveDateContext(date);
  // B档定版：搜索母题来自赛道文件（唯一来源），不再读账号记忆副本
  const trackDoc = account.track_id
    ? await getDoc<Record<string, any>>("track_config", account.track_id)
    : null;
  const trackDirections: string[] = Array.isArray(trackDoc?.bridge?.search_directions)
    ? trackDoc!.bridge.search_directions.filter((d: unknown): d is string => typeof d === "string")
    : [];
  const ownerView = searchParams?.view !== "admin";
  const viewHref = `/account/${account.account_id}${date ? `?date=${date}&` : "?"}view=${ownerView ? "admin" : "owner"}`;

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
      />

      <Link href={`/accounts${date ? `?date=${date}` : ""}`} className="text-sm text-[#5C7A2E] no-underline hover:underline">
        返回账号列表
      </Link>
      <Link href={viewHref} className="ml-4 text-sm text-[#5C7A2E] no-underline hover:underline">
        {ownerView ? "打开后台视图" : "回老板视图"}
      </Link>

      <section className="mt-4 rounded-lg border border-[#D8D3CB] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#7A7770]">账号主页</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">{account.display_name}</h1>
            <p className="mt-1 text-sm text-[#6B6963]">
              {account.track_name ?? account.track_id} · {account.platform_name ?? account.platform_id} ·{" "}
              {account.positioning_name ?? account.positioning_id}
            </p>
          </div>
          <Link
            href={`/today?account=${account.account_id}`}
            className="rounded-md border border-[#B8B5AD] px-3 py-2 text-sm text-[#343330] no-underline hover:bg-[#F3F1EC]"
          >
            打开旧今日页
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <MemoryBlock label="卖什么" value={displayText(account.memory.business ?? "未填")} />
          <MemoryBlock label="卖给谁" value={displayText(account.memory.audience ?? "未填")} />
          <MemoryBlock label="产品价值" value={displayText(account.memory.product_value ?? "未填")} />
          <MemoryBlock label="客户焦虑" value={listText(account.memory.anxiety_anchors)} />
          <MemoryBlock label="信任证据" value={listText(account.memory.proof_assets)} />
          <MemoryBlock label="不能碰的词和话题" value={listText([...forbidden, ...(account.memory.banned_topics ?? [])])} />
        </div>

        <div className="mt-4 rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
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
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#D8D3CB] bg-white p-5 text-sm text-[#6B6963]">
              这个账号在所选日期没有安装推荐结果。
            </div>
          )}
        </div>
      </section>

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
    </main>
  );
}
