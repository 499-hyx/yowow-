"use client";

// 账号记忆页 = 「账号大脑」——只读展示。
// 文件驱动模式：账号从 /api/accounts 取。
// 要修改记忆，直接编辑 data/accounts/<id>.json 后刷新页面。

import Link from "next/link";
import { useEffect, useState } from "react";

import type { StoredAccount } from "@/lib/adaptation-types";
import { memoryCompleteness, memorySections } from "@/lib/memory-meta";

export default function MemoryPage() {
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [missing, setMissing] = useState<boolean>(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("account");
    if (!id) {
      setMissing(true);
      return;
    }
    fetch("/api/accounts")
      .then((r) => r.json() as Promise<StoredAccount[]>)
      .then((list) => {
        const a = list.find((x) => x.account_id === id) ?? null;
        if (!a) setMissing(true);
        else setAccount(a);
      })
      .catch(() => setMissing(true));
  }, []);

  if (missing) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-[#4A4A47]">没找到这个账号。</p>
        <Link href="/" className="mt-3 inline-block text-sm text-[#5C7A2E] hover:underline">
          ← 回账号工作台
        </Link>
      </main>
    );
  }
  if (!account) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-48 animate-pulse rounded-xl bg-[#F0EDE5]" />
      </main>
    );
  }

  const m = account.memory ?? {};
  const sections = memorySections(m);
  const comp = memoryCompleteness(m);
  const understood = m.understood;
  const normalSections = sections;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pb-16">
      {/* 面包屑 + 头部 */}
      <div className="text-xs text-[#9B9892]">
        <Link href="/" className="text-[#6B6963] no-underline hover:underline">账号工作台</Link>
        <span className="mx-1">/</span>
        <span>账号记忆</span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1F1F1E]">{account.display_name}</h1>
          <p className="mt-1 text-sm text-[#6B6963]">
            {[account.track_name, account.platform_name, account.positioning_name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link
          href={`/today?account=${encodeURIComponent(account.account_id)}`}
          className="rounded-md bg-[#5C7A2E] px-3 py-1.5 text-sm font-medium text-white no-underline hover:opacity-90"
        >
          看今日推荐 →
        </Link>
      </div>

      {/* 修改说明 */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#E0D9CE] bg-[#F8F4EE] px-4 py-3">
        <span className="mt-0.5 text-base">✏️</span>
        <p className="text-sm text-[#6B6963]">
          修改方式：编辑{" "}
          <code className="rounded bg-[#EDE6DB] px-1 text-xs">data/accounts/{account.account_id}.json</code>
          {" "}后刷新页面。
        </p>
      </div>

      {/* 完整度横幅 */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E8E6E1] bg-white px-4 py-3">
        <div className="h-2 w-36 overflow-hidden rounded bg-[#F0EDE5]">
          <div
            className={`h-2 rounded ${comp.percent >= 80 ? "bg-[#5C7A2E]" : "bg-[#C9A24B]"}`}
            style={{ width: `${comp.percent}%` }}
          />
        </div>
        <span className="text-sm text-[#4A4A47]">
          记忆完整度 {comp.filled}/{comp.total}
        </span>
        <span className="text-xs text-[#9B9892]">
          {comp.missing.length > 0
            ? `补齐「${comp.missing.join("、")}」后，热点筛选和文案会更贴你的号。`
            : "核心信息齐了。每天的筛选、判断、文案口吻都以这页为准。"}
        </span>
      </div>

      {/* B档：搜索母题已上收至赛道层，请到「赛道与母题」页查看/校准 */}
      <div className="mt-4 rounded-xl border border-[#E0D9CE] bg-[#F8F4EE] px-4 py-3 text-sm text-[#6B6963]">
        找热点的「搜索母题」现在统一放在赛道层（一处定稿、全账号生效）——
        <Link href="/tracks" className="text-[#5C7A2E] no-underline hover:underline">去「赛道与母题」查看</Link>。
      </div>

      {/* 其余区块：两列栅格 */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {normalSections.map((s) => (
          <div key={s.key} className="rounded-xl border border-[#E8E6E1] bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-[#1F1F1E]">
                {s.label}
                {!s.filled ? (
                  <span className="ml-2 rounded-full bg-[#F5EDDE] px-2 py-0.5 text-xs font-normal text-[#7A5520]">
                    待补充
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#9B9892]">{s.why}</p>
            </div>
            {s.filled ? (
              s.preview.length === 1 && (s.key === "business" || s.key === "audience" || s.key === "product_value" || s.key === "style") ? (
                <p className="mt-2 text-sm leading-relaxed text-[#1F1F1E]">{s.preview[0]}</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.preview.map((x) => (
                    <span
                      key={x}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        s.key === "forbidden" ? "bg-[#EBE9E5] text-[#6B6963]" : "bg-[#F0EDE5] text-[#4A4A47]"
                      }`}
                    >
                      {s.key === "forbidden" ? `不碰：${x}` : x}
                    </span>
                  ))}
                </div>
              )
            ) : (
              <p className="mt-2 text-sm text-[#9B9892]">{s.emptyHint}</p>
            )}
          </div>
        ))}

        {/* 系统理解的你（只读） */}
        <div className="rounded-xl border border-dashed border-[#C9C6BF] bg-[#FAF9F7] p-4 md:col-span-2">
          <p className="text-sm font-semibold text-[#1F1F1E]">系统理解的你</p>
          <p className="mt-1 text-xs leading-relaxed text-[#9B9892]">
            根据你的定位整理的「对外怎么讲」：写文案时常用这些角度，绝不用下面标了「不说」的词。
            想调整就改 data/accounts/{account.account_id}.json，刷新后生效。
          </p>
          {understood ? (
            <div className="mt-3 space-y-2">
              {understood.business_understood ? (
                <p className="text-sm text-[#4A4A47]">
                  <span className="text-[#9B9892]">你的生意：</span>
                  {understood.business_understood}
                  {understood.goal_understood ? (
                    <span className="text-[#9B9892]">　想达成：</span>
                  ) : null}
                  {understood.goal_understood}
                </p>
              ) : null}
              {understood.external_vocab.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {understood.external_vocab.map((w) => (
                    <span key={w} className="rounded-full bg-[#E8F0DC] px-2.5 py-1 text-xs text-[#3E5C20]">
                      {w}
                    </span>
                  ))}
                </div>
              ) : null}
              {understood.forbidden_terms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {understood.forbidden_terms.map((w) => (
                    <span key={w} className="rounded-full bg-[#EBE9E5] px-2.5 py-1 text-xs text-[#6B6963]">
                      不说：{w}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#9B9892]">完成一次配置后，这里会展示系统对你的理解。</p>
          )}
        </div>
      </div>
    </main>
  );
}
