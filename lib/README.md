# lib/ 目录说明

这里放前端和服务端共享的读取、格式化、展示辅助逻辑。不要把核心跑批安装逻辑放到 `lib/`；正式安装今日结果只走 `scripts/ingest.py`。

## 主要模块

| 文件 | 用途 |
|---|---|
| `data-source.ts` | 本地文件 / Turso docs 的读取入口 |
| `file-data.ts` | 读取 `data/accounts/`、`data/today/` |
| `config-data.ts` | 读取 `config/` |
| `config-contracts.ts` | 规范化配置结构 |
| `dashboard-data.ts` | 首页数据聚合 |
| `server-data.ts` | `/api/options` 的配置选项装配；不是 today 生成入口 |
| `onboarding-questionnaire.mjs` | `/onboarding` 问卷问题和 JSON 草稿生成 |
| `display-text.ts` | 用户可见文案转换，避免内部术语裸露 |
| `skip-gate.ts` | 展示层保守拦截辅助 |
| `pipeline-status.ts` | 跑批状态展示 |
| `ops-workbench.ts` | `/ops` 本地跑批台服务端动作：保存热点池、保存 `_inbox`、运行 preflight / make-prompt / ingest |
| `turso.ts` | Turso 客户端封装 |

## 修改建议

- 改展示文案：优先看 `display-text.ts` 和页面组件。
- 改问卷问题：改 `onboarding-questionnaire.mjs`。
- 改数据读取：看 `data-source.ts`、`file-data.ts`、`config-data.ts`。
- 改本地运营台保存路径或按钮动作：看 `ops-workbench.ts` 和 `app/api/ops/*`。
- 不要在 `lib/` 里新增绕过 `ingest.py` 的写入 today 逻辑。
- 早期 localStorage 账号仓库、前端 today 缓存和暖启动 seed 已归档到 `docs/archive/code-history/`，不要再按当前实现使用。
