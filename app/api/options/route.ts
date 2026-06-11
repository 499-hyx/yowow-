// GET /api/options —— 引导屏选项：赛道 / 平台 / 人设。
// 全部从 config/ 读出（赛道卡与桥梁母题预览来自 tracks/*.json，博士/老板写）。
// 加新赛道 = 加一份 config/tracks/<id>.json，本路由零改动（I9）。

import type { OptionsResponse } from "@/lib/api-contracts";
import {
  loadPersonaOptions,
  loadPlatformOptions,
  loadSeedAccounts,
  loadTrackOptions,
} from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const resp: OptionsResponse = {
      tracks: loadTrackOptions(),
      platforms: loadPlatformOptions(),
      personas: loadPersonaOptions(),
      seedAccounts: loadSeedAccounts(),
    };
    return Response.json(resp);
  } catch (e) {
    console.error("[/api/options] 读取配置失败:", e);
    return Response.json(
      { tracks: [], platforms: [], personas: [], seedAccounts: [] } satisfies OptionsResponse,
      { status: 500 },
    );
  }
}
