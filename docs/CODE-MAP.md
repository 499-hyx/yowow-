# 代码模块地图

本文给工程师快速定位代码。当前项目是文件驱动 MVP：`data/ + config/` 是事实源，`scripts/ingest.py` 是唯一安装 `data/today/<account_id>/latest.json` 的入口。

## 0. 当前活路径

```text
data/accounts + config/tracks/platforms/positionings
  -> scripts/make-prompt.py
  -> data/runs/<date>/<account_id>/prompts/*.txt
  -> 外部 LLM / agent / 人工回贴到 _inbox
  -> scripts/ingest.py
  -> data/today/<account_id>/latest.json
  -> lib/data-source.ts / lib/dashboard-data.ts / lib/file-data.ts
  -> app/page.tsx / app/account/[account_id]/page.tsx
```

`app/api/today/route.ts` 也是 today 数据读口，但首页和账号页主要通过 `lib/*` 服务端读取聚合，不是必须先打 API。

不要从旧暖启动、在线 regenerate、engine-bridge 这些历史/预览路径理解当前 MVP 主链路。

## 1. 前端页面和 API

| 模块 | 路径 | 说明 |
|---|---|---|
| 首页 / 今日总览 | `app/page.tsx` | 账号今日状态总览 |
| 账号列表 | `app/accounts/page.tsx` | 读取 `data/accounts/` |
| 账号页 | `app/account/[account_id]/page.tsx` | 展示单账号 latest、记忆、推荐卡 |
| 单人跑批台 | `app/ops/page.tsx` | 本地运营入口：复制热点提示词、保存热点池、生成 match/generate prompt、粘回 GPT JSON、触发 ingest |
| onboarding 问卷页 | `app/onboarding/page.tsx` | 生成账号 JSON / 赛道 JSON 草稿，不在线保存 |
| 赛道页 | `app/tracks/page.tsx` | 展示赛道、搜索方向和校准矩阵 |
| 热点页 | `app/hotspots/page.tsx` | 展示热点池 |
| 热点详情页 | `app/hotspots/[hotspot_id]/page.tsx` | 单条热点详情 |
| 卡片页 | `app/card/[account_id]/[date]/[hotspot_id]/page.tsx` | 单条内容卡直达页 |
| 反馈归档页 | `app/feedback/page.tsx` | 展示已归档反馈文件 |
| 归档页 | `app/archive/page.tsx` | 历史日期查看 |
| `/today` 兼容入口 | `app/today/page.tsx` | redirect 到账号页 `tab=today` |
| `/memory` 兼容入口 | `app/memory/page.tsx` | redirect 到账号页 `tab=memory` |
| 今日 API | `app/api/today/route.ts` | 只读 latest，不写 `data/today/` |
| 账号 API | `app/api/accounts/route.ts` | 只读账号列表 |
| 账号归档 API | `app/api/accounts/[account_id]/route.ts` | 本地归档/删除账号文件；线上拒绝 |
| 账号记忆 API | `app/api/accounts/[account_id]/memory/route.ts` | 本地 patch 账号记忆并备份；线上拒绝 |
| feedback API | `app/api/feedback/route.ts` | 收集反馈到 Turso inbox 或本地 fallback |
| ops API | `app/api/ops/*` | 本地跑批台动作；生产 + Turso 模式拒绝本地写入 |
| options API | `app/api/options/route.ts` | onboarding / 页面选项读取 |
| regenerate API | `app/api/regenerate/route.ts` | 当前明确不在线重跑 |
| onboarding API | `app/api/onboarding/route.ts` | 当前不在线创建账号 |
| spark API | `app/api/spark/route.ts` | 线上模式不直接写本地文件 |

目录说明见 `app/README.md`。

## 2. 组件

| 模块 | 路径 | 说明 |
|---|---|---|
| 今日板 | `components/adaptation/TodayBoard.tsx` | 今日内容决策台 |
| 推荐卡 | `components/adaptation/RecommendationCard.tsx` | 单条推荐/跳过卡 |
| 反馈条 | `components/adaptation/FeedbackBar.tsx` | 卡片反馈 |
| 账号记忆 | `components/adaptation/MemoryEditor.tsx` | 账号记忆展示/编辑入口 |
| 灵感入口 | `components/adaptation/SparkInbox.tsx` | 临时灵感收集 |
| 跑批台 | `components/adaptation/OpsWorkbench.tsx` | `/ops` 的交互主体，含批量复制提示词和粘贴 JSON 回贴 |

目录说明见 `components/README.md`。

## 3. lib/ 共享逻辑

| 模块 | 路径 | 说明 |
|---|---|---|
| 类型 | `lib/adaptation-types.ts` | 推荐、账号、反馈等核心 TS 类型 |
| API 契约 | `lib/api-contracts.ts` | 前端/API 类型对齐；不是生成入口 |
| 数据源切换 | `lib/data-source.ts` | 本地文件 / Turso docs 读取层 |
| 本地文件读取 | `lib/file-data.ts` | 读 `data/accounts`、`data/today` |
| 配置读取 | `lib/config-data.ts` | 读 `config/` |
| 配置规范化 | `lib/config-contracts.ts` | 历史/新配置统一成前端可读形状 |
| dashboard 汇总 | `lib/dashboard-data.ts` | 首页、热点页、归档页数据聚合 |
| onboarding 选项装配 | `lib/server-data.ts` | `/api/options` 读取 `config/` 的赛道、平台、人设和种子账号；不是 today 生成入口 |
| 赛道校准 | `lib/track-calibration.ts` | 赛道页矩阵和方向统计 |
| onboarding 问卷 | `lib/onboarding-questionnaire.mjs` | 问题、选项、JSON 草稿生成 |
| 可见文案转换 | `lib/display-text.ts` | 避免内部术语裸露 |
| skip gate | `lib/skip-gate.ts` | 预览层保守拦截辅助；正式闸门在 Python ingest |
| 状态展示 | `lib/pipeline-status.ts` | 跑批状态计算 |
| 本地/线上模式文案 | `lib/pr6-state.mjs` | 页面动作和提示文案 |
| Turso 客户端 | `lib/turso.ts` | 只在配置了环境时使用 |
| 跑批台本地操作 | `lib/ops-workbench.ts` | 保存热点池、保存 `_inbox`、运行 preflight/make-prompt/ingest；保存回贴前校验当前账号已有对应 prompt 文件 |

目录说明见 `lib/README.md`。

## 4. scripts/ 跑批脚本

| 脚本 | 说明 |
|---|---|
| `scripts/status.py` | 跑前 preflight / 跑后 full status |
| `scripts/make-prompt.py` | 读取账号、赛道、热点，渲染 match/generate 提示词 |
| `scripts/answer.py` | 可选自动答题：调用外部模型写 `_inbox` |
| `scripts/ingest.py` | 唯一安装闸门：校验回贴并写 `data/today` |
| `scripts/sync-to-db.py` | 默认只 dry-run；正式 sync 必须授权 |
| `scripts/pull-feedback.py` | 把反馈 inbox 拉回本地 |
| `scripts/validate-configs.mjs` | 配置结构校验 |
| `scripts/migrate-to-file-driven.py` | 历史迁移脚本，通常不再日常执行 |
| `scripts/mvp_policy.py` | internal MVP 状态标记辅助，被 status/make-prompt/ingest 依赖 |

目录说明见 `scripts/README.md`。

## 5. 配置、数据、提示词

| 目录 | 说明 |
|---|---|
| `config/` | 长期配置。说明见 `config/README.md` |
| `data/` | 本地事实数据和跑批产物。说明见 `data/README.md` |
| `prompts/` | 可编辑提示词模板。说明见 `prompts/README.md` |
| `test/` | 回归测试。说明见 `test/README.md` |

补充：

- `config/deprecated/bridge-directions/` 是旧搜索方向备份；当前真实搜索方向在 `config/tracks/<track_id>.json` 的 `bridge.search_directions`。
- 非 today 写入路径包括 `/api/ops/*`、`/api/feedback`、`/api/spark`、账号 memory/delete API。它们不等于绕过 ingest，但不能写 `data/today/`。

## 6. 历史 / 预览 / 谨慎路径

| 文件 | 状态 |
|---|---|
| `docs/archive/code-history/engine-bridge.ts.md` | 早期在线引擎桥代码归档；当前不在运行路径 |
| `docs/archive/code-history/account-store.ts.md` | 早期 localStorage 多账号仓库归档；当前不在运行路径 |
| `docs/archive/code-history/profile-store.ts.md` | 早期单账号 localStorage 占位归档；当前不在运行路径 |
| `docs/archive/code-history/warm-start-seed.ts.md` | 原 `lib/warm-start-seed.ts`，历史暖启动样例；当前不在运行路径 |
| `docs/archive/code-history/today-cache.ts.md` | 早期前端缓存辅助归档；当前不在运行路径 |
| `docs/archive/code-history/server-data-preview-helpers.md` | 原 `lib/server-data.ts` 中未引用的 warm-start / preview helpers；当前不在运行路径 |
| `docs/archive/` | 历史方案和旧 runbook，只作追溯 |
| `prompts/归档/` | 旧提示词索引和已迁移占位文件 |

## 7. 不要破坏的边界

- 不要让任何 API 直接写 `data/today/<account_id>/latest.json`。
- 不要绕过 `scripts/ingest.py` 安装今日结果。
- 不要把 Turso 改成主数据库。
- 不要把 archive 文档当成当前流程。
- 不要把 `/onboarding` 改成线上自助入驻，除非另起正式工单。
