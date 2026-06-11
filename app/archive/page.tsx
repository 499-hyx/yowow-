import Link from "next/link";

import DateContextBar from "@/components/adaptation/DateContextBar";
import { loadAccountHistory, listHotspotDates, resolveDateContext } from "@/lib/dashboard-data";
import { loadDataAccounts } from "@/lib/file-data";

export const dynamic = "force-dynamic";

export default async function ArchivePage({ searchParams }: { searchParams?: { date?: string } }) {
  const dateContext = await resolveDateContext(searchParams?.date);
  const dates = (await listHotspotDates()).reverse();
  const accounts = await loadDataAccounts();
  const histories = await Promise.all(
    accounts.map(async (account) => ({
      account,
      history: await loadAccountHistory(account.account_id),
    })),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <DateContextBar
        date={dateContext.date}
        prevDate={dateContext.prevDate}
        nextDate={dateContext.nextDate}
        latestDate={dateContext.latestDate}
        basePath="/archive"
      />

      <div>
        <p className="text-sm font-medium text-[#7A7770]">历史档案</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">按日期回看跑批结果</h1>
        <p className="mt-1 text-sm text-[#6B6963]">先做轻量入口：热点池日期和各账号历史都能直接跳转。</p>
      </div>

      <section className="mt-5 rounded-lg border border-[#D8D3CB] bg-white p-4">
        <h2 className="text-base font-bold text-[#1F1F1E]">热点池日期</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {dates.length ? (
            dates.map((date) => (
              <Link
                key={date}
                href={`/hotspots?date=${date}`}
                className="rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#343330] no-underline hover:bg-[#F3F1EC]"
              >
                {date}
              </Link>
            ))
          ) : (
            <span className="text-sm text-[#7A7770]">暂无热点池归档。</span>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        {histories.map(({ account, history }) => {
          return (
            <article key={account.account_id} className="rounded-lg border border-[#D8D3CB] bg-white p-4">
              <h2 className="text-base font-bold text-[#1F1F1E]">{account.display_name}</h2>
              <div className="mt-3 overflow-hidden rounded-md border border-[#EEEAE2]">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-[#F3F1EC] text-left text-xs text-[#6B6963]">
                    <tr>
                      <th className="px-3 py-2 font-medium">日期</th>
                      <th className="px-3 py-2 font-medium">必发</th>
                      <th className="px-3 py-2 font-medium">拍板</th>
                      <th className="px-3 py-2 font-medium">别蹭</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.date} className="border-t border-[#EEEAE2]">
                        <td className="px-3 py-2">
                          <Link
                            href={`/account/${account.account_id}?date=${row.date}`}
                            className="text-[#2D5D8A] no-underline hover:underline"
                          >
                            {row.date}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{row.strong}</td>
                        <td className="px-3 py-2">{row.maybe}</td>
                        <td className="px-3 py-2">{row.skipped}</td>
                      </tr>
                    ))}
                    {!history.length ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-5 text-[#7A7770]">
                          暂无历史。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
