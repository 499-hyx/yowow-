import Link from "next/link";

import AccountsWorkbench, { type AccountListItem } from "@/components/adaptation/AccountsWorkbench";
import DateContextBar from "@/components/adaptation/DateContextBar";
import { loadAccountHistory, resolveDateContext } from "@/lib/dashboard-data";
import { loadDataAccounts } from "@/lib/file-data";

export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams?: { date?: string } }) {
  const dateContext = await resolveDateContext(searchParams?.date);
  const storedAccounts = await loadDataAccounts();
  const accounts: AccountListItem[] = await Promise.all(storedAccounts.map(async (account) => {
    const latest = (await loadAccountHistory(account.account_id))[0];
    return {
      ...account,
      latest_summary: latest
        ? `${latest.date} · ${latest.strong} 必发 / ${latest.maybe} 拍板 / ${latest.skipped} 别蹭`
        : "暂无历史",
    };
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <DateContextBar
        date={dateContext.date}
        prevDate={dateContext.prevDate}
        nextDate={dateContext.nextDate}
        latestDate={dateContext.latestDate}
        basePath="/accounts"
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#7A7770]">账号</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">账号主页入口</h1>
          <p className="mt-1 text-sm text-[#6B6963]">每个账号都有自己的记忆、今日推荐和历史摘要。</p>
        </div>
        <Link
          href="/onboarding"
          className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-black"
        >
          新增账号
        </Link>
      </div>

      <AccountsWorkbench initialAccounts={accounts} currentDate={dateContext.date} />
    </main>
  );
}
