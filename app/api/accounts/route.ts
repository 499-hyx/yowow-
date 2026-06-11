// GET /api/accounts —— 列出 data/accounts/*.json 中的所有账号档案。
// 文件驱动模式：账号是文件，不再依赖 localStorage 存本体；
// 前端从这里取账号列表，localStorage 只存当前选中账号 ID 等 UI 状态。

import { loadDataAccounts } from "@/lib/file-data";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const accounts = await loadDataAccounts();
  return Response.json(accounts);
}
