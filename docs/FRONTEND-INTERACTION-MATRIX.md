# Frontend Interaction Matrix

以下命令默认在 `yowow-adaptation/` 目录下执行。

这份文档记录当前 MVP 前端真实可访问页面的按钮/链接行为。前端边界不变：网站负责只读展示、生成本地 handoff、收反馈；正式内容安装仍只走 `scripts/ingest.py`。

## 验收命令

```bash
npm run test:e2e
```

浏览器测试覆盖主路径：导航、问卷 JSON 预览与复制、复制失败提示、删除取消提示、反馈提交状态、灵感读取失败提示。

## 当前页面交互

| 页面 | 交互 | 当前行为 | 失败/禁用反馈 |
|---|---|---|---|
| `/` 今日总览 | 新增账号 | 跳转 `/onboarding` | 路由失败由浏览器/Next 显示 |
| `/` 今日总览 | 进入热点池 | 跳转 `/hotspots?date=...` | 路由失败由浏览器/Next 显示 |
| `/` 今日总览 | 复制话术 | 复制当前待办话术 | 复制失败显示 `复制失败` |
| `/ops` 每日跑批台 | 切换日期 / 账号 | 改变本次热点池、prompt、_inbox、ingest 的目标路径 | 当前需人工确认选中账号和日期；后续建议持久化到 URL 或 localStorage |
| `/ops` 每日跑批台 | 复制热点提示词 | 复制公共热点 / 终极雷达 / 赛道热点搜索提示词 | 复制失败显示复制失败；提示词只要求输出可入池 JSON |
| `/ops` 每日跑批台 | 保存全网热点 / 赛道热点 | 写入 `data/hotspots/<date>.json` 或 `data/hotspots/tracks/<track_id>/<date>.json` | JSON 格式错误、缺 `title` 会显示可读错误；缺 `hotspot_id` 时系统按日期和来源补 ID |
| `/ops` 每日跑批台 | 生成 match 提示词 | 调用 `scripts/make-prompt.py --step match`，写入 `data/runs/<date>/<account_id>/prompts/match-*.txt` | 缺热点池、账号、配置时显示错误 |
| `/ops` 每日跑批台 | 保存 match 回贴 | 把 GPT 返回 JSON 拆成 `_inbox/match-<hotspot_id>.json` | 如果当前账号没有对应 prompt，拒绝保存并提示切回正确账号 |
| `/ops` 每日跑批台 | 生成 generate 提示词 | 调用 `scripts/make-prompt.py --step generate`，只为非 skip 热点生成 `generate-*.txt` | match 未保存或全 skip 时不会生成内容提示词 |
| `/ops` 每日跑批台 | 保存 generate 回贴 | 把 GPT 返回 JSON 拆成 `_inbox/generate-<hotspot_id>.json` | 如果回贴和当前账号 / 平台 / 赛道不匹配，会提示切回生成这批提示词时的账号 |
| `/ops` 每日跑批台 | 安装到今日页面 | 调用 `scripts/ingest.py`，成功后写 `data/today/<account_id>/<date>.json` 和 `latest.json` | ingest 失败不写半成品；按错误回到 match/generate 单条重答 |
| `/onboarding` | 问卷输入 | 实时生成账号 JSON 和赛道 JSON 草稿 | 不在线保存 |
| `/onboarding` | 复制账号 JSON / 赛道 JSON | 写入剪贴板并显示 `已复制` | 显示 `复制失败，请手动选中文本复制。` |
| `/accounts` | 打开主页 | 跳转账号页 | 路由失败由浏览器/Next 显示 |
| `/accounts` | 删除 | 先弹确认；确认后本地归档账号和历史结果 | 取消显示 `已取消删除。`；线上或 API 失败显示错误文案 |
| `/account/<id>?tab=today` | 内容卡展开/折叠 | 原生 details 展开推荐说明和脚本 | 无网络依赖 |
| `/account/<id>?tab=today` | 内容卡 / 原报道 / 热点链接 | 跳转内部详情或打开外部素材 | 外链打开失败由浏览器处理 |
| `/account/<id>?tab=today` | 保存反馈 | 三项评分后 POST `/api/feedback` | 未评分禁用；保存中/成功/失败都有文案 |
| `/account/<id>?tab=memory` | 编辑账号记忆 | 本地模式 PATCH 账号 JSON；线上模式只读 | 线上显示本地文件修改说明；保存失败显示错误文案 |
| `/account/<id>?tab=spark` | 提交灵感 | 本地模式写入 `data/spark-inbox/` | 空内容禁用；线上改为复制本地记录；读取失败显示错误文案 |
| `/hotspots` | 热点详情 / 原素材 | 跳转热点详情或外部素材 | 外链打开失败由浏览器处理 |
| `/tracks` | 赛道切换 | 通过 query 切换只读校准台 | 无写入 |
| `/archive` | 日期/账号历史 | 跳转热点池或账号历史日期 | 无写入 |
| `/card/<account>/<date>/<hotspot>` | 复制脚本 | 写入剪贴板并显示 `已复制` | 复制失败显示 `复制失败` |
| `/card/<account>/<date>/<hotspot>` | 保存反馈 | POST `/api/feedback` | 未评分禁用；保存中/成功/失败都有文案 |

## 不属于当前前端按钮职责

- 在线实时生成内容。
- 绕过 `scripts/ingest.py` 写 `data/today/<account_id>/latest.json`。
- 在线正式保存 `/onboarding` 生成的账号/赛道 JSON。
- 正式 `sync-to-db.py`。
- 登录、RBAC、多租户权限、支付。
- 线上环境使用 `/ops` 写本地文件；生产 + Turso 模式下 `app/api/ops/*` 会拒绝这些操作。
