import OpsWorkbench from "@/components/adaptation/OpsWorkbench";
import { loadDataAccounts } from "@/lib/file-data";
import { renderHotspotPrompts } from "@/lib/ops-workbench";
import { todayInShanghai } from "@/lib/pr6-state.mjs";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const accounts = await loadDataAccounts();
  const initialDate = todayInShanghai();
  const firstAccount = accounts[0]?.account_id;
  let initialPrompts = null;
  if (firstAccount) {
    try {
      initialPrompts = renderHotspotPrompts({
        date: initialDate,
        accountId: firstAccount,
      });
    } catch {
      initialPrompts = null;
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#7A7770]">本地运营台</p>
          <h1 className="mt-1 text-3xl font-bold tracking-normal text-[#1F1F1E]">每日跑批台</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#6B6963]">
            一个人每天照着任务清单跑：复制提示词到网页版 GPT，把 GPT 返回结果粘回来，最后安装到今日页面。
            技术路径默认收起，出错时再展开查看。
          </p>
        </div>
      </div>
      <OpsWorkbench accounts={accounts} initialDate={initialDate} initialPrompts={initialPrompts} />
    </main>
  );
}
