// B档（2026-06-11）：网页 onboarding 下线。
// 原因：网页入口绕过「赛道车间 → 博士定稿」流程，会造出没有母题、没定稿的空脑子账号。
// 新增账号/赛道统一走 agent（见 yowow-adaptation/AGENT-PLAYBOOK.md 入口④）。

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-[#E0D9CE] bg-[#F8F4EE] p-8 text-center">
        <div className="text-3xl">{"\u{1F3D7}\uFE0F"}</div>
        <h1 className="mt-3 text-xl font-bold text-[#1F1F1E]">新增账号请找管理员</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#6B6963]">
          新账号需要先为它的赛道起草「搜索母题」并经博士定稿，才能产出可信的每日推荐——这一步在网页上做不了。
          请联系管理员，说清楚：<b>卖什么给谁、产品最大的好、有什么证据、客户最焦虑什么、发什么平台、什么人设、什么不能碰</b>。
          已有赛道的新账号几分钟就能开通；全新赛道需要等博士定稿后生效。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-black"
        >
          回今日总览
        </Link>
      </div>
    </main>
  );
}
