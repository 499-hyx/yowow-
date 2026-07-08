// B档（2026-06-11）：网页 onboarding API 下线。
// 当前 MVP 不做网页自助新增，也不做审批/权限系统。
// 新增账号走 /onboarding 问卷生成本地 JSON，见 docs/RUNBOOK.md 的「新增账号」。

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      error: "网页新增账号已下线：当前 MVP 直接创建 data/accounts/<account_id>.json，不走审批或权限流程。",
    },
    { status: 410 },
  );
}
