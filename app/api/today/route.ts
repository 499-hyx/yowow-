// GET/POST /api/today —— 文件驱动模式：读 data/today/<account_id>/latest.json。
//
// 外部流程（RUNBOOK）每天跑批生成 latest.json，网站只负责读文件展示。
// 不调 LLM，不依赖 ANTHROPIC_API_KEY。
//
// 文件缺失 → 人话提示「今天还没跑，照 RUNBOOK 跑一遍就有了」
// JSON 损坏 → 回退最近一份日期归档 + 横幅「展示的是 X 日数据」

import type { TodayRequest, TodayResponse } from "@/lib/api-contracts";
import type { AccountProfile } from "@/lib/adaptation-types";
import { loadDataAccount, loadTodayFile } from "@/lib/file-data";

export const dynamic = "force-dynamic";

function emptyResponse(account: AccountProfile, notice: string): TodayResponse {
  return {
    account,
    board: { picks: [], also_ran: [], skipped: [] },
    meta: {},
    mode: "sample",
    notice,
  };
}

function defaultAccount(accountId: string, fallback?: Partial<AccountProfile>): AccountProfile {
  return {
    account_id: accountId,
    tenant_id: "tenant-trial",
    display_name: fallback?.display_name ?? "账号",
    track_id: fallback?.track_id ?? "custom",
    platform_id: fallback?.platform_id ?? "xiaohongshu",
    positioning_id: fallback?.positioning_id ?? "expert",
    status: "active",
  };
}

async function respond(
  accountId: string,
  reqAccount?: Partial<AccountProfile>,
): Promise<Response> {
  // 从 data/accounts/ 取权威账号档案
  const stored = await loadDataAccount(accountId);
  const account: AccountProfile = stored
    ? {
        account_id: stored.account_id,
        tenant_id: stored.tenant_id,
        display_name: stored.display_name,
        track_id: stored.track_id,
        platform_id: stored.platform_id,
        positioning_id: stored.positioning_id,
        status: stored.status,
      }
    : defaultAccount(accountId, reqAccount);

  const result = await loadTodayFile(accountId);

  if (!result) {
    return Response.json(
      emptyResponse(
        account,
        "今天的内容还没生成，照 docs/RUNBOOK.md 的五步跑一遍就有了。",
      ),
    );
  }

  const { response, fallbackDate } = result;
  const notice = fallbackDate
    ? `展示的是 ${fallbackDate} 的数据（今天的文件读取有问题），可按 RUNBOOK 重新跑今天。`
    : response.notice;

  return Response.json({ ...response, account, notice });
}

export async function POST(request: Request): Promise<Response> {
  let body: TodayRequest;
  try {
    body = (await request.json()) as TodayRequest;
  } catch {
    return Response.json({ error: "请求格式不对" }, { status: 400 });
  }
  const a = body?.account;
  if (!a?.account_id) {
    return Response.json({ error: "缺少 account_id" }, { status: 400 });
  }
  return respond(a.account_id, a);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("account") ?? "";
  if (!accountId) {
    return Response.json({ error: "缺少 account 参数" }, { status: 400 });
  }
  return respond(accountId);
}
