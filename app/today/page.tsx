"use client";

// 今日推荐页 /today?account=<id>：内容决策台。
// 文件驱动模式：账号从 /api/accounts 取（不走 localStorage 本体）。
// 当天结果按账号缓存（决策 B：按需 + 缓存），「重算今天」触发 /api/today 重读文件；
// 反馈提交后记录完成态，可一键导出今日反馈 JSON 给下次跑批人工带上。

import Link from "next/link";
import { useEffect, useState } from "react";

import { TodayBoard } from "@/components/adaptation";
import type {
  AdaptationOutput,
  BoardState,
  DailyBoard,
  FeedbackPayload,
  HotspotMetaMap,
  StoredAccount,
} from "@/lib/adaptation-types";
import type {
  FeedbackRequest,
  RegenerateRequest,
  RegenerateResponse,
  TodayResponse,
} from "@/lib/api-contracts";
import { setActiveAccountId } from "@/lib/account-store";
import {
  fetchToday,
  feedbackDoneSet,
  markFeedbackDone,
  saveTodayCache,
  type TodayStats,
} from "@/lib/today-cache";

const EMPTY_BOARD: DailyBoard = { picks: [], also_ran: [], skipped: [] };

export default function TodayPage() {
  const [state, setState] = useState<BoardState>("loading");
  const [data, setData] = useState<TodayResponse | null>(null);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [noAccount, setNoAccount] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [noteIds, setNoteIds] = useState<Record<string, string>>({});
  const [doneIds, setDoneIds] = useState<Record<string, boolean>>({});
  const [exportedNote, setExportedNote] = useState<boolean>(false);

  function syncDone(accountId: string) {
    const set = feedbackDoneSet(accountId);
    const map: Record<string, boolean> = {};
    set.forEach((id) => {
      map[id] = true;
    });
    setDoneIds(map);
  }

  async function load(a: StoredAccount, force: boolean) {
    if (force) setRefreshing(true);
    else setState("loading");
    try {
      const { resp, stats: st } = await fetchToday(a, force);
      setData(resp);
      setStats(st);
      syncDone(a.account_id);
      setState(resp.board.picks.length > 0 ? "ready" : "no_pick_today");
    } catch {
      setState("error");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("account");
    if (!id) {
      setNoAccount(true);
      setState("ready");
      return;
    }
    setActiveAccountId(id);
    // 账号从 API 取（→ data/accounts/*.json），不走 localStorage 本体
    fetch("/api/accounts")
      .then((r) => r.json() as Promise<StoredAccount[]>)
      .then((list) => {
        const a = list.find((x) => x.account_id === id) ?? null;
        if (!a) {
          setNoAccount(true);
          setState("ready");
          return;
        }
        setAccount(a);
        void load(a, false);
      })
      .catch(() => {
        setNoAccount(true);
        setState("ready");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replaceOutput(next: AdaptationOutput, meta?: HotspotMetaMap[string]) {
    setData((prev) => {
      if (!prev) return prev;
      const strip = (list: AdaptationOutput[]) => list.filter((o) => o.hotspot_id !== next.hotspot_id);
      const board: DailyBoard =
        next.recommendation === "skip"
          ? { picks: strip(prev.board.picks), also_ran: prev.board.also_ran, skipped: [...strip(prev.board.skipped), next] }
          : { picks: [...strip(prev.board.picks), next], also_ran: prev.board.also_ran, skipped: strip(prev.board.skipped) };
      const updated: TodayResponse = {
        ...prev,
        board,
        meta: meta ? { ...prev.meta, [next.hotspot_id]: meta } : prev.meta,
      };
      if (account) setStats(saveTodayCache(account.account_id, updated)); // 同步缓存
      return updated;
    });
  }

  async function regenerate(hotspotId: string) {
    if (!account) return;
    setBusyIds((b) => ({ ...b, [hotspotId]: true }));
    setNoteIds((n) => ({ ...n, [hotspotId]: "" }));
    try {
      const req: RegenerateRequest = {
        hotspot_id: hotspotId,
        track_id: account.track_id,
        platform_id: account.platform_id,
        positioning_id: account.positioning_id,
        memory: account.memory,
      };
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const body = (await res.json()) as RegenerateResponse;
      if (body.ok && body.output) {
        replaceOutput(body.output, body.meta);
      } else {
        setNoteIds((n) => ({ ...n, [hotspotId]: body.reason || "这次没生成成功，稍后再试。" }));
      }
    } catch {
      setNoteIds((n) => ({ ...n, [hotspotId]: "网络不太顺，稍后再点一次。" }));
    } finally {
      setBusyIds((b) => ({ ...b, [hotspotId]: false }));
    }
  }

  async function sendFeedback(hotspotId: string, payload: FeedbackPayload): Promise<boolean> {
    if (!account) return false;
    const req: FeedbackRequest = {
      output_ref: {
        hotspot_id: hotspotId,
        track_id: account.track_id,
        platform_id: account.platform_id,
        positioning_id: account.positioning_id,
      },
      payload,
    };
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      const body = (await res.json()) as { ok?: boolean };
      if (body.ok) {
        markFeedbackDone(account.account_id, hotspotId);
        syncDone(account.account_id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // 导出今日反馈 JSON：跑批时人工带上，让下一次结果更准
  function exportFeedbackJson() {
    if (!account) return;
    const submittedIds = Object.keys(doneIds).filter((k) => doneIds[k]);
    const exportPayload = {
      exported_at: new Date().toISOString(),
      account_id: account.account_id,
      date: new Date().toISOString().slice(0, 10),
      feedback_submitted_ids: submittedIds,
      board: data?.board ?? EMPTY_BOARD,
    };
    try {
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = `feedback-${account.account_id}-${exportPayload.date}.json`;
      el.click();
      URL.revokeObjectURL(url);
      setExportedNote(true);
      window.setTimeout(() => setExportedNote(false), 2400);
    } catch {
      // 降级：直接提示手动复制
    }
  }

  if (noAccount) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-dashed border-[#D9D6CF] bg-[#FAF9F7] p-6 text-center">
          <p className="text-sm text-[#4A4A47]">还没有账号。先到工作台选一个样板号，或者新配一个。</p>
          <Link
            href="/"
            className="mt-3 inline-block rounded-md bg-[#5C7A2E] px-4 py-2 text-sm font-medium text-white no-underline hover:opacity-90"
          >
            去账号工作台 →
          </Link>
        </div>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[#F0EDE5]" />
          ))}
        </div>
      </main>
    );
  }

  const doneCount = Object.values(doneIds).filter(Boolean).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 pb-16">
      {/* 面包屑 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9B9892]">
        <div>
          <Link href="/" className="text-[#6B6963] no-underline hover:underline">账号工作台</Link>
          <span className="mx-1">/</span>
          <span>今日推荐</span>
        </div>
        {/* 导出今日反馈 JSON */}
        {doneCount > 0 ? (
          <button
            type="button"
            onClick={exportFeedbackJson}
            className="rounded-md border border-[#C9C6BF] px-3 py-1.5 text-xs text-[#4A4A47] hover:bg-[#F0EDE5]"
          >
            {exportedNote ? "已导出 ✓" : `导出今日反馈 JSON（${doneCount} 条）`}
          </button>
        ) : null}
      </div>

      <TodayBoard
        account={data?.account ?? account}
        board={data?.board ?? EMPTY_BOARD}
        meta={data?.meta ?? {}}
        state={state}
        platformName={account.platform_name}
        notice={data?.notice}
        mode={data?.mode}
        generatedAt={stats?.generated_at}
        busyIds={busyIds}
        noteIds={noteIds}
        feedbackDoneIds={doneIds}
        memoryHref={`/memory?account=${encodeURIComponent(account.account_id)}`}
        refreshing={refreshing}
        onRefresh={() => void load(account, true)}
        onSwitchAccount={() => {
          window.location.href = "/";
        }}
        onRetry={() => void load(account, true)}
        onCopy={(text) => {
          void navigator.clipboard?.writeText(text);
        }}
        onRegenerate={(id) => void regenerate(id)}
        onFeedbackSubmit={(id, payload) => sendFeedback(id, payload)}
      />
    </main>
  );
}
