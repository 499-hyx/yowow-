import Link from "next/link";

type Props = {
  date: string | null;
  prevDate?: string | null;
  nextDate?: string | null;
  latestDate?: string | null;
  basePath?: string;
  query?: Record<string, string | null | undefined>;
};

function hrefFor(basePath: string, date: string | null | undefined, query?: Props["query"]) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) params.set(key, value);
  }
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export default function DateContextBar({
  date,
  prevDate,
  nextDate,
  latestDate,
  basePath = "/",
  query,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#D8D3CB] bg-white px-3 py-2 text-sm">
      <div className="font-medium text-[#1F1F1E]">
        当前日期：<span className="tabular-nums">{date ?? "暂无热点池"}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefFor(basePath, prevDate, query)}
          aria-disabled={!prevDate}
          className={`rounded-md border px-3 py-1.5 no-underline ${
            prevDate
              ? "border-[#B8B5AD] text-[#343330] hover:bg-[#F3F1EC]"
              : "pointer-events-none border-[#E3E0D8] text-[#B8B5AD]"
          }`}
        >
          上一天
        </Link>
        <Link
          href={hrefFor(basePath, nextDate, query)}
          aria-disabled={!nextDate}
          className={`rounded-md border px-3 py-1.5 no-underline ${
            nextDate
              ? "border-[#B8B5AD] text-[#343330] hover:bg-[#F3F1EC]"
              : "pointer-events-none border-[#E3E0D8] text-[#B8B5AD]"
          }`}
        >
          下一天
        </Link>
        <Link
          href={hrefFor(basePath, latestDate, query)}
          className="rounded-md bg-[#1F1F1E] px-3 py-1.5 text-white no-underline hover:bg-black"
        >
          回到最新
        </Link>
      </div>
    </div>
  );
}
