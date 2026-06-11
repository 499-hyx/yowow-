import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type FeedbackFile = {
  date: string;
  account_id: string;
  file: string;
  path: string;
  hotspot_id?: string;
  status?: string;
  scores?: string;
};

function listFeedbackFiles(): FeedbackFile[] {
  const runsDir = path.join(process.cwd(), "data", "runs");
  if (!fs.existsSync(runsDir)) return [];
  const rows: FeedbackFile[] = [];
  for (const date of fs.readdirSync(runsDir).sort().reverse()) {
    const dateDir = path.join(runsDir, date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !fs.statSync(dateDir).isDirectory()) continue;
    for (const accountId of fs.readdirSync(dateDir).sort()) {
      const accountDir = path.join(dateDir, accountId);
      if (!fs.statSync(accountDir).isDirectory()) continue;

      const candidates = [
        { dir: accountDir, prefix: "" },
        { dir: path.join(accountDir, "feedback-inbox"), prefix: "feedback-inbox/" },
      ];

      for (const candidate of candidates) {
        if (!fs.existsSync(candidate.dir)) continue;
        for (const file of fs.readdirSync(candidate.dir).sort()) {
          if (!/feedback.*\.json$/i.test(file) && !/^fb-.*\.json$/i.test(file)) continue;
          const filePath = path.join(candidate.dir, file);
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
          } catch {
            parsed = {};
          }
          const payload = parsed.payload as Record<string, unknown> | undefined;
          const scores = payload
            ? [payload.can_publish, payload.bridge_natural, payload.angle_fit]
                .filter((value) => typeof value === "number")
                .join(" / ")
            : "";
          rows.push({
            date,
            account_id: accountId,
            file: `${candidate.prefix}${file}`,
            path: filePath,
            hotspot_id: typeof parsed.hotspot_id === "string" ? parsed.hotspot_id : undefined,
            status: typeof parsed.status === "string" ? parsed.status : undefined,
            scores,
          });
        }
      }
    }
  }
  return rows;
}

export default function FeedbackPage() {
  const files = listFeedbackFiles();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <div>
        <p className="text-sm font-medium text-[#7A7770]">反馈收件箱</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1F1F1E]">反馈归档入口</h1>
        <p className="mt-1 text-sm text-[#6B6963]">
          本阶段先只展示已归档反馈文件；真正的打分回流和母题调权留到下一阶段。
        </p>
      </div>

      <section className="mt-5 rounded-lg border border-[#D8D3CB] bg-white p-4">
        <h2 className="text-base font-bold text-[#1F1F1E]">已发现的反馈文件</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-[#EEEAE2]">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-[#F3F1EC] text-left text-xs text-[#6B6963]">
              <tr>
                <th className="px-3 py-2 font-medium">日期</th>
                <th className="px-3 py-2 font-medium">账号</th>
                <th className="px-3 py-2 font-medium">热点</th>
                <th className="px-3 py-2 font-medium">评分</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">文件</th>
              </tr>
            </thead>
            <tbody>
              {files.map((item) => (
                <tr key={`${item.date}-${item.account_id}-${item.file}`} className="border-t border-[#EEEAE2]">
                  <td className="px-3 py-2">{item.date}</td>
                  <td className="px-3 py-2">{item.account_id}</td>
                  <td className="px-3 py-2">{item.hotspot_id ?? "未标记"}</td>
                  <td className="px-3 py-2">{item.scores || "旧格式"}</td>
                  <td className="px-3 py-2">{item.status ?? "待归档"}</td>
                  <td className="px-3 py-2">{item.file}</td>
                </tr>
              ))}
              {!files.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-[#7A7770]">
                    目前没有发现反馈 JSON。日常跑批时可用 <code>ingest.py --feedback &lt;反馈文件&gt;</code> 归档。
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
