import { saveHotspotPool } from "@/lib/ops-workbench";

import { errorResponse, onlineOpsBlocked, readJsonBody } from "../_shared";

export const dynamic = "force-dynamic";

type Body = {
  date?: string;
  kind?: "broad" | "track";
  track_id?: string;
  text?: string;
};

export async function POST(request: Request): Promise<Response> {
  const blocked = onlineOpsBlocked();
  if (blocked) return blocked;

  try {
    const body = await readJsonBody<Body>(request);
    if (!body.date || !body.kind || typeof body.text !== "string") {
      throw new Error("缺少 date、kind 或热点 JSON。");
    }
    const result = saveHotspotPool({
      date: body.date,
      kind: body.kind,
      trackId: body.track_id,
      text: body.text,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
