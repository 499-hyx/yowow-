import { saveInboxReplies } from "@/lib/ops-workbench";

import { errorResponse, onlineOpsBlocked, readJsonBody } from "../_shared";

export const dynamic = "force-dynamic";

type Body = {
  date?: string;
  account_id?: string;
  stage?: string;
  text?: string;
};

export async function POST(request: Request): Promise<Response> {
  const blocked = onlineOpsBlocked();
  if (blocked) return blocked;

  try {
    const body = await readJsonBody<Body>(request);
    if (!body.date || !body.account_id || !body.stage || typeof body.text !== "string") {
      throw new Error("缺少 date、account_id、stage 或回贴 JSON。");
    }
    const result = saveInboxReplies({
      date: body.date,
      accountId: body.account_id,
      stage: body.stage,
      text: body.text,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
