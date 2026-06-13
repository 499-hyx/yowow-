// B档（2026-06-11）：网页 onboarding 下线。
// 原因：网页入口绕过「赛道车间 → 博士定稿」流程，会造出没有母题、没定稿的空脑子账号。
// 新增账号/赛道统一走 agent（见 yowow-adaptation/AGENT-PLAYBOOK.md 入口④）。

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-[#E0D9CE] bg-[#F8F4EE] p-8">
        <h1 className="text-xl font-bold text-[#1F1F1E]">新增账号请找管理员处理</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6B6963]">
          网页现在不能直接新建账号或赛道。一个账号能不能推荐得准，先取决于它所属赛道的搜索母题、表达边界和禁区是否配置好；这些需要管理员整理后同步进系统。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#6B6963]">
          请把这些信息发给管理员：卖什么给谁、产品最大的好、有什么证据、客户最焦虑什么、发什么平台、什么人设、什么不能碰。管理员处理完成后，账号会出现在账号列表里，并在下一次跑批时生效。
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
