// B档（2026-06-11）：网页 onboarding API 下线。
// 新增账号/赛道统一走 agent 流程（AGENT-PLAYBOOK.md 入口④：赛道车间 / 账号快速通道），
// 保证每条赛道的搜索母题都经过起草→博士定稿，再进入跑批。

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      error: "网页新增账号已下线：请联系管理员通过 agent 新增（需先为赛道起草搜索母题并经博士定稿）。",
    },
    { status: 410 },
  );
}
