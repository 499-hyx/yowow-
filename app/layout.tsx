import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "内容桥梁台 · YOWOW Adaptation",
  description: "多赛道 × 多账号的热点适配作战台。",
};

const NAV = [
  { label: "今日总览", href: "/" },
  { label: "热点池", href: "/hotspots" },
  { label: "账号", href: "/accounts" },
  { label: "赛道与母题", href: "/tracks" },
  { label: "历史档案", href: "/archive" },
  { label: "反馈收件箱", href: "/feedback" },
];

function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-[#E3E0D8] bg-[#F7F5F0] px-4 py-5 lg:block">
      <a href="/" className="flex items-center gap-2 no-underline">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1F1F1E] text-sm font-bold text-white">
          桥
        </span>
        <div>
          <div className="text-base font-bold leading-tight text-[#1F1F1E]">内容桥梁台</div>
          <div className="text-xs text-[#7A7770]">文件驱动 · 只读展示</div>
        </div>
      </a>

      <nav className="mt-7 space-y-1">
        {NAV.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm font-medium text-[#343330] no-underline hover:bg-white hover:text-[#1F1F1E]"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="mt-8 rounded-lg border border-dashed border-[#C9C5BA] bg-white/60 p-3 text-xs leading-relaxed text-[#6B6963]">
        网站只读 `data/`。今日页、热点池、账号页都来自同一份跑批快照；写入只走 ingest。
      </div>
    </aside>
  );
}

function MobileNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#E3E0D8] bg-[#FAF9F7]/95 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <a href="/" className="text-sm font-bold text-[#1F1F1E] no-underline">
          内容桥梁台
        </a>
        <a
          href="/onboarding"
          className="rounded-md border border-[#B8B5AD] px-3 py-1.5 text-xs text-[#343330] no-underline"
        >
          新增账号
        </a>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm">
        {NAV.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="shrink-0 rounded-md bg-white px-3 py-1.5 text-[#4A4A47] no-underline"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <MobileNav />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
