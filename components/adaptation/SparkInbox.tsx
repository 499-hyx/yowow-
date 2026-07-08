"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { SparkRecord, SparkStatus } from "@/app/api/spark/route";
import CopyTextButton from "@/components/adaptation/CopyTextButton";
import { sparkAdminCopy } from "@/lib/pr6-state.mjs";

const STATUS_LABELS: Record<SparkStatus, string> = {
  pending: "待处理",
  ingested: "已入池",
  rejected: "未采用",
};

function statusTone(status: SparkStatus): string {
  if (status === "ingested") return "border-[#A9C682] bg-[#F2F8E9] text-[#36591C]";
  if (status === "rejected") return "border-[#D8D3CB] bg-[#F3F1EC] text-[#5B5852]";
  return "border-[#E1C58F] bg-[#FFF8EA] text-[#755019]";
}

export default function SparkInbox({
  accountId,
  accountName,
  readOnly = false,
  readOnlyDescription,
}: {
  accountId: string;
  accountName: string;
  readOnly?: boolean;
  readOnlyDescription?: string;
}) {
  const [text, setText] = useState("");
  const [sparks, setSparks] = useState<SparkRecord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/spark?account_id=${encodeURIComponent(accountId)}`);
      const body = (await res.json()) as { ok?: boolean; sparks?: SparkRecord[]; error?: string };
      if (!body.ok) {
        setMessage(body.error ?? "读取失败。");
        return;
      }
      setSparks(body.sparks ?? []);
      setMessage("");
    } catch {
      setMessage("读取失败：本地服务没有响应。");
      setSparks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function submit() {
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/spark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account_id: accountId, text }),
      });
      const body = (await res.json()) as { ok?: boolean; spark?: SparkRecord; error?: string };
      if (!body.ok || !body.spark) {
        setMessage(body.error ?? "提交失败。");
        return;
      }
      setText("");
      setSparks((prev) => [body.spark!, ...prev]);
      setMessage("已收下，处理发生在每日跑热点时。");
    } catch {
      setMessage("网络不太顺，稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  const groups = useMemo(() => {
    return {
      pending: sparks.filter((spark) => spark.status === "pending"),
      ingested: sparks.filter((spark) => spark.status === "ingested"),
      rejected: sparks.filter((spark) => spark.status === "rejected"),
    };
  }, [sparks]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#D8D3CB] bg-white p-4">
        {readOnly ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[#6B6963]">
              {readOnlyDescription ?? "线上当前不能直接提交灵感。请把下面的话保存为本地灵感记录；下一次跑批前放入热点池或账号上下文。"}
            </p>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-28 w-full rounded-md border border-[#D8D3CB] bg-[#FBFAF7] p-3 text-sm leading-relaxed outline-none focus:border-[#5C7A2E]"
              placeholder="把灵感写在这里，用下面的话术保存成本地记录"
            />
            <div className="rounded-md border border-[#E8E6E1] bg-[#FBFAF7] p-3">
              <div className="text-xs font-medium text-[#8A877F]">复制话术</div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#4A4A47]">
                {sparkAdminCopy(accountName, text.trim())}
              </p>
              <div className="mt-2">
                <CopyTextButton text={sparkAdminCopy(accountName, text.trim())} label="复制本地记录" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-32 w-full rounded-md border border-[#D8D3CB] bg-[#FBFAF7] p-3 text-sm leading-relaxed outline-none focus:border-[#5C7A2E]"
              placeholder="想到什么写什么，明天跑热点时会自动带上"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#7A7770]">这里只负责收集，处理发生在每日跑热点时。</p>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || !text.trim()}
                className="rounded-md bg-[#1F1F1E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "提交中" : "提交灵感"}
              </button>
            </div>
          </>
        )}
        {message ? <p className="mt-2 text-sm text-[#755019]">{message}</p> : null}
      </section>

      {(["pending", "ingested", "rejected"] as SparkStatus[]).map((status) => (
        <section key={status}>
          <h3 className="mb-2 text-sm font-bold text-[#5B5852]">
            {STATUS_LABELS[status]}
            <span className="ml-2 font-normal text-[#9B9892]">{groups[status].length} 条</span>
          </h3>
          <div className="divide-y divide-[#EEEAE2] rounded-lg border border-[#D8D3CB] bg-white">
            {groups[status].map((spark) => (
              <article key={spark.spark_id} className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(spark.status)}`}>
                    {STATUS_LABELS[spark.status]}
                  </span>
                  <span className="text-xs text-[#9B9892]">{spark.spark_id}</span>
                  {spark.hotspot_id ? (
                    <Link href={`/hotspots/${spark.hotspot_id}`} className="text-xs text-[#2D5D8A] no-underline hover:underline">
                      查看入池热点
                    </Link>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#4A4A47]">{spark.text}</p>
                {spark.reject_reason ? <p className="mt-2 text-xs text-[#7A7770]">原因：{spark.reject_reason}</p> : null}
              </article>
            ))}
            {!loading && !groups[status].length ? (
              <div className="px-3 py-5 text-sm text-[#9B9892]">暂无。</div>
            ) : null}
            {loading && status === "pending" ? <div className="px-3 py-5 text-sm text-[#9B9892]">读取中。</div> : null}
          </div>
        </section>
      ))}
    </div>
  );
}
