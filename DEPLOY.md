# DEPLOY.md — 上线给同事使用（Vercel + Turso 双源架构）

> 这是一个**独立的 Next.js 应用 + 独立的 Vercel 项目**。
> ⛔ 绝不部署到小朱的 `yowow-content-board`，绝不用 `vercel deploy` / `vercel --prod` CLI（路径 doubling）。部署走 Git 推送触发，或 Vercel API / 控制台 Redeploy。
> （2026-06-11 重写：旧版"网站实时调 LLM"的部署方式已废弃，现行架构是文件驱动 + Turso 镜像，网站不调 LLM。）

## 架构一句话

**本地文件是唯一事实源，Turso 是网站的只读镜像，反馈是唯一回流。**
跑批管线（make-prompt / ingest）照旧在本地跑；跑完同步上库，线上即更新。

```
本地（你 + agent）                            云端（同事访问）
┌────────────────────────────┐               ┌──────────────────────────┐
│ 入池 → make-prompt →        │  sync-to-db   │  Vercel (Next.js)        │
│ agent 作答 → ingest         │ ───────────▶ │  只读 Turso docs 表       │
│ data/ + config/（事实源）    │               │                          │
│          ▲                 │ pull-feedback │  同事打分→ feedback_inbox │
│          └─────────────────│ ◀─────────── │                          │
└────────────────────────────┘               └──────────────────────────┘
```

双源开关：环境变量 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` 存在 → 读库（生产）；不存在 → 读本地文件（开发，零配置，行为与从前完全一致）。

## 一次性：建库与部署（约 30 分钟）

1. **建 Turso 库**

   ```bash
   turso db create yowow-adaptation
   turso db show yowow-adaptation --url        # → TURSO_DATABASE_URL
   turso db tokens create yowow-adaptation     # → TURSO_AUTH_TOKEN
   ```

2. **首次同步**（建表自动）

   ```bash
   cd yowow-adaptation
   export TURSO_DATABASE_URL=libsql://...  TURSO_AUTH_TOKEN=...
   python3 scripts/sync-to-db.py
   ```

3. **Vercel**：独立项目指向本仓库（Root Directory = `yowow-adaptation`，或独立仓库根）；环境变量加 `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`（Production + Preview）；git push 触发部署。

4. **验收**：线上 `/` 与本地今日总览一致；`/card` 任意打开一张卡打分 → 本地跑 `python3 scripts/pull-feedback.py` 能拉到。

## 每天的节奏（比从前多两条命令）

```bash
python3 scripts/pull-feedback.py   # 跑批前：拉同事昨天打的分
# …… 入池 + 跑批（对 agent 说话，照 AGENT-PLAYBOOK.md）……
python3 scripts/sync-to-db.py      # 跑批后：同步上库，线上即更新
```

可并入 agent 日常话术：「拉反馈」「同步上线」。

## 双源行为对照

| 功能 | 本地（无环境变量） | 线上（Vercel + Turso） |
|---|---|---|
| 全部展示页（总览/热点池/账号/卡片/赛道/档案） | 读 data/ + config/ | 读 Turso docs 表 |
| 同事打反馈分 | 写 data/runs/.../feedback-inbox/ | 写 feedback_inbox 表，等 pull |
| 删除/暂停账号、网页 onboarding | 可用（写文件） | **不可用（有意设计）**——账号操作走本地 agent，下次 sync 生效 |
| 跑批 / 生成内容 | 本地脚本 + agent | 网站永远不调 LLM |

写权限全部留在本地事实源，避免双写冲突——线上只有"看"和"打分"。

## 自检命令

```bash
python3 scripts/sync-to-db.py --selftest     # 同步逻辑（本地 sqlite，/tmp）
python3 scripts/sync-to-db.py --dry-run      # 看会同步什么
python3 scripts/pull-feedback.py --selftest  # 反馈落地逻辑
npm run typecheck && npm run build           # 前端
```

## 换 / 加赛道（不改任何代码）

1. agent 入口④：7 问 → `config/tracks/<id>.json` + `config/bridge-directions/<id>.json`（博士定稿）。
2. `python3 scripts/sync-to-db.py` → 线上出现新赛道。

## 已知边界

- docs 表是全量镜像（当前约 30 份文档）；数据量大后 sync 可改增量，暂不需要。
- 线上数据新鲜度 = 最后一次 `sync-to-db.py` 的时间。
- `data/runs/`（提示词渲染稿/回贴/审计材料）**不上库**，留在本地。
- 旧版 DEPLOY 提到的 `ANTHROPIC_API_KEY` / engine-bridge 实时生成已不再用于本站，无需配置。
