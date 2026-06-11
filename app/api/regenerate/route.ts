// POST /api/regenerate —— 文件驱动模式：无条件返回 ok:false。
// 在线重新生成不可用，请按 RUNBOOK 跑批后替换 data/today/<account_id>/latest.json。

import type { RegenerateResponse } from "@/lib/api-contracts";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return Response.json({
    ok: false,
    reason:
      "文件模式下暂不支持在线重新生成，请跑批后把新结果放进 data/today/<账号 ID>/latest.json，刷新网页即可。",
  } satisfies RegenerateResponse);
}
