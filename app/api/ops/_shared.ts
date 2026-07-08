import { tursoEnabled } from "@/lib/turso";

export function onlineOpsBlocked(): Response | null {
  if (process.env.NODE_ENV !== "production" || !tursoEnabled()) return null;
  return Response.json(
    {
      ok: false,
      error: "线上环境不允许使用本地跑批台。请在本机运行 dev server 后操作。",
    },
    { status: 403 },
  );
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("请求体不是有效 JSON。");
  }
}

export function errorResponse(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : "操作失败。";
  return Response.json({ ok: false, error: message }, { status });
}
