// POST /api/feedback
//
// P0 反馈 v1：只保存 owner 评分 JSON，不改变 today 推荐，不做自动调权。
// 后续仍由 scripts/ingest.py --feedback 归档进运行记录。

import fs from "node:fs";
import path from "node:path";

import type { FeedbackRequest, FeedbackResponse } from "@/lib/api-contracts";
import type { FeedbackDims } from "@/lib/adaptation-types";
import { tursoEnabled, tursoExecute } from "@/lib/turso";

export const dynamic = "force-dynamic";

const DIM_KEYS: (keyof FeedbackDims)[] = [
  "track_relevance",
  "connection_naturalness",
  "platform_fit",
  "persona_fit",
  "publish_value",
];

function validDims(dims: Partial<FeedbackDims> | undefined): boolean {
  if (!dims) return false;
  return DIM_KEYS.every((k) => {
    const v = dims[k];
    // 五维都要真实点过（1-5），不再接受零分占位
    return typeof v === "number" && v >= 1 && v <= 5;
  });
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function safeSegment(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9._-]+$/.test(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

type FeedbackV1Body = {
  account_id?: unknown;
  date?: unknown;
  hotspot_id?: unknown;
  output_ref?: {
    hotspot_id?: unknown;
    track_id?: unknown;
    platform_id?: unknown;
    positioning_id?: unknown;
  };
  payload?: {
    can_publish?: unknown;
    bridge_natural?: unknown;
    angle_fit?: unknown;
    note?: unknown;
  };
};

function isFeedbackV1(body: unknown): body is FeedbackV1Body {
  if (!body || typeof body !== "object") return false;
  const candidate = body as FeedbackV1Body;
  return "account_id" in candidate || "date" in candidate || "hotspot_id" in candidate;
}

async function writeFeedbackV1(body: FeedbackV1Body): Promise<FeedbackResponse> {
  if (
    !safeSegment(body.account_id) ||
    !validDate(body.date) ||
    !safeSegment(body.hotspot_id) ||
    !body.output_ref ||
    !safeSegment(body.output_ref.hotspot_id) ||
    !safeSegment(body.output_ref.track_id) ||
    !safeSegment(body.output_ref.platform_id) ||
    !safeSegment(body.output_ref.positioning_id) ||
    !body.payload ||
    !validScore(body.payload.can_publish) ||
    !validScore(body.payload.bridge_natural) ||
    !validScore(body.payload.angle_fit)
  ) {
    return { ok: false };
  }

  const feedbackId = `fb-${Date.now()}`;
  const record = {
    status: "pending_ingest",
    feedback_id: feedbackId,
    saved_at: new Date().toISOString(),
    account_id: body.account_id,
    date: body.date,
    hotspot_id: body.hotspot_id,
    output_ref: body.output_ref,
    payload: {
      can_publish: body.payload.can_publish,
      bridge_natural: body.payload.bridge_natural,
      angle_fit: body.payload.angle_fit,
      note: typeof body.payload.note === "string" ? body.payload.note : undefined,
    },
  };

  if (tursoEnabled()) {
    // 生产（Vercel）：写 feedback_inbox 表，由 scripts/pull-feedback.py 拉回本地归档
    await tursoExecute(
      "INSERT INTO feedback_inbox (account_id, date, body, created_at) VALUES (?, ?, ?, ?)",
      [body.account_id, body.date, JSON.stringify(record), new Date().toISOString()],
    );
    return { ok: true, feedback_id: feedbackId };
  }

  // 本地：照旧写文件
  const dir = path.join(process.cwd(), "data", "runs", body.date, body.account_id, "feedback-inbox");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${feedbackId}-${body.hotspot_id}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf-8");
  return { ok: true, feedback_id: feedbackId };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false } satisfies FeedbackResponse, { status: 400 });
  }

  if (isFeedbackV1(body)) {
    const resp = await writeFeedbackV1(body);
    return Response.json(resp, { status: resp.ok ? 200 : 400 });
  }

  const legacyBody = body as FeedbackRequest;
  if (!legacyBody?.output_ref?.hotspot_id || !validDims(legacyBody?.payload?.dims)) {
    return Response.json({ ok: false } satisfies FeedbackResponse, { status: 400 });
  }
  // DEPLOY: 落 Turso feedback 表 + feedback_reflow 回流次日。
  const resp: FeedbackResponse = { ok: true, feedback_id: `fb-${Date.now()}` };
  return Response.json(resp);
}
