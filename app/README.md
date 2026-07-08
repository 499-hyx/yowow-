# app/ 目录说明

这里是 Next.js App Router 页面和 API。原则：页面/API 只读展示和收集反馈，不负责生成内容，不绕过 `scripts/ingest.py` 写 `data/today/`。

## 页面

| 路径 | 用途 |
|---|---|
| `page.tsx` | 首页 / 今日总览 |
| `accounts/page.tsx` | 账号列表 |
| `account/[account_id]/page.tsx` | 单账号今日内容页 |
| `ops/page.tsx` | 本地单人跑批台：复制热点提示词、保存热点池、生成 prompt、粘回 GPT JSON、调用 ingest |
| `onboarding/page.tsx` | 问卷生成账号 JSON / 赛道 JSON 草稿，不在线保存 |
| `tracks/page.tsx` | 赛道列表和搜索方向 |
| `hotspots/page.tsx` | 热点池查看 |
| `hotspots/[hotspot_id]/page.tsx` | 单条热点详情 |
| `feedback/page.tsx` | 反馈入口 |
| `archive/page.tsx` | 历史结果查看 |
| `today/page.tsx` | 兼容入口，重定向到账号页 `tab=today` |
| `memory/page.tsx` | 兼容入口，重定向到账号页 `tab=memory` |

## API

| 路径 | 用途 |
|---|---|
| `api/accounts/route.ts` | 只读账号列表 |
| `api/accounts/[account_id]/route.ts` | 本地账号归档/删除等账号文件操作 |
| `api/accounts/[account_id]/memory/route.ts` | 本地账号记忆读取/修改；线上应保持只读或受限 |
| `api/today/route.ts` | 只读 today/latest |
| `api/feedback/route.ts` | 收集反馈 |
| `api/ops/*` | 本地跑批台动作；生产 + Turso 模式拒绝本地写入 |
| `api/options/route.ts` | onboarding / 页面选项读取 |
| `api/regenerate/route.ts` | 当前不在线重跑 |
| `api/onboarding/route.ts` | 当前不在线创建账号 |
| `api/spark/route.ts` | 灵感入口；线上模式不直接写本地文件 |

## 红线

- 不要让 API 直接写 `data/today/<account_id>/latest.json`。
- 不要在页面里调用 LLM 生成今日内容。
- `/onboarding` 不是线上自助入驻系统。
- `/ops` 只允许作为本地运维台理解，不是线上生产跑批入口。
