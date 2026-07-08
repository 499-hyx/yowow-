import { runMakePrompt } from "@/lib/ops-workbench";

import { errorResponse, onlineOpsBlocked, readJsonBody } from "../_shared";

export const dynamic = "force-dynamic";

type Body = {
  date?: string;
  account_id?: string;
  stage?: string;
};

export async function POST(request: Request): Promise<Response> {
  const blocked = onlineOpsBlocked();
  if (blocked) return blocked;

  try {
    const body = await readJsonBody<Body>(request);
    if (!body.date || !body.account_id || !body.stage) {
      throw new Error("缺少 date、account_id 或 stage。");
    }
    const result = await runMakePrompt({
      date: body.date,
      accountId: body.account_id,
      stage: body.stage,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
