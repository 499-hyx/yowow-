"use client";

import Link from "next/link";
import { useState } from "react";

import type { StoredAccount } from "@/lib/adaptation-types";
import { displayText } from "@/lib/display-text";

export type AccountListItem = StoredAccount & {
  latest_summary?: string;
};

export default function AccountsWorkbench({
  initialAccounts,
  currentDate,
}: {
  initialAccounts: AccountListItem[];
  currentDate?: string | null;
}) {
  const [accounts, setAccounts] = useState<AccountListItem[]>(initialAccounts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");

  async function deleteAccount(account: AccountListItem) {
    const ok = window.confirm(
      `删除「${account.display_name}」？\n\n账号会从工作台移除，账号文件和历史推荐会归档到 data/deleted/，不是直接抹掉。`,
    );
    if (!ok) {
      setNotice("已取消删除。");
      return;
    }

    setBusyId(account.account_id);
    setNotice("");
    try {
      const res = await fetch(`/api/accounts/${account.account_id}`, { method: "DELETE" });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setNotice(body.error ?? "删除失败。");
        return;
      }
      setAccounts((list) => list.filter((item) => item.account_id !== account.account_id));
      setNotice(`已删除并归档：${account.display_name}`);
    } catch {
      setNotice("删除失败：本地服务没有响应。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-5">
      {notice ? (
        <div className="mb-3 rounded-md border border-[#D8D3CB] bg-white px-3 py-2 text-sm text-[#4A4A47]">
          {notice}
        </div>
      ) : null}

      {accounts.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {accounts.map((account) => (
            <article
              key={account.account_id}
              className="rounded-lg border border-[#D8D3CB] bg-white p-4 text-[#1F1F1E]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/account/${account.account_id}${currentDate ? `?date=${currentDate}` : ""}`}
                    className="text-base font-bold text-[#1F1F1E] no-underline hover:underline"
                  >
                    {account.display_name}
                  </Link>
                  <p className="mt-1 text-xs text-[#7A7770]">
                    {account.track_name ?? account.track_id} · {account.platform_name ?? account.platform_id} ·{" "}
                    {account.positioning_name ?? account.positioning_id}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded-md bg-[#FBFAF7] p-3">
                  <div className="text-xs text-[#8A877F]">产品价值</div>
                  <p className="mt-1 line-clamp-2 leading-relaxed text-[#4A4A47]">
                    {displayText(account.memory.product_value ?? "未填")}
                  </p>
                </div>
                <div className="rounded-md bg-[#FBFAF7] p-3">
                  <div className="text-xs text-[#8A877F]">最近跑批</div>
                  <p className="mt-1 leading-relaxed text-[#4A4A47]">{account.latest_summary ?? "暂无历史"}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/account/${account.account_id}${currentDate ? `?date=${currentDate}` : ""}`}
                  className="rounded-md border border-[#B8B5AD] px-3 py-1.5 text-sm text-[#343330] no-underline hover:bg-[#F3F1EC]"
                >
                  打开主页
                </Link>
                <button
                  type="button"
                  disabled={busyId === account.account_id}
                  onClick={() => deleteAccount(account)}
                  className="rounded-md border border-[#C9A39A] px-3 py-1.5 text-sm text-[#8A2F1B] hover:bg-[#FFF3EF] disabled:opacity-50"
                >
                  {busyId === account.account_id ? "删除中..." : "删除"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#D8D3CB] bg-white p-6 text-sm text-[#6B6963]">
          账号都已删除或还没有账号。可以点右上角新增账号重新创建。
        </div>
      )}
    </section>
  );
}
