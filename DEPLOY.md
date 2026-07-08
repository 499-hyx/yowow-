# DEPLOY.md — 可选上线镜像（Vercel + Turso）

> 这是一个**独立的 Next.js 应用 + 独立的 Vercel 项目**。
> ⛔ 绝不部署到小朱的 `yowow-content-board`，绝不用 `vercel deploy` / `vercel --prod` CLI（路径 doubling）。部署走 Git 推送触发，或 Vercel API / 控制台 Redeploy。
> （2026-06-11 重写：旧版"网站实时调 LLM"的部署方式已废弃，现行架构是文件驱动 + Turso 镜像，网站不调 LLM。）

## 当前定位

本文只描述“把本地 MVP 结果镜像到 Vercel + Turso 供同事查看”的可选生产步骤。日常验收默认只跑 `python3 scripts/sync-to-db.py --dry-run`；正式 `python3 scripts/sync-to-db.py` 只有在确认 Turso 是安全 dev/test 环境，或负责人明确授权后执行。

**本地文件是唯一事实源，Turso 是网站的只读镜像，反馈是唯一回流。**
跑批管线（make-prompt / ingest）照旧在本地跑；跑完先做 dry-run 预检，授权后才同步上库。

```
本地（你 + agent）                            云端（同事访问）
┌────────────────────────────┐               ┌──────────────────────────┐
│ 入池 → make-prompt →        │ dry-run       │  Vercel (Next.js)        │
│ agent 作答 → ingest         │ /授权后同步 ─▶│  只读 Turso docs 表       │
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

2. **首次同步预检**（不写远端）

   ```bash
   cd yowow-adaptation
   export TURSO_DATABASE_URL=libsql://...  TURSO_AUTH_TOKEN=...
   python3 scripts/sync-to-db.py --dry-run
   ```

   确认 dry-run 列出的文档、账号、today/latest 都正确后，且负责人授权正式同步，才执行：

   ```bash
   python3 scripts/sync-to-db.py
   ```

3. **Vercel**：独立项目指向本仓库，按下面配置，不要使用默认猜测值：

   ```text
   Framework Preset: Next.js
   Root Directory: yowow-adaptation
   Install Command: npm install
   Build Command: npm run build
   Node.js Version: 20.x
   ```

   `npm run build` 必须保留，因为它会先跑 `scripts/ensure-track-prompts.mjs`，再执行 `next build`。不要改回 `next build`。

   环境变量只加：

   ```text
   TURSO_DATABASE_URL
   TURSO_AUTH_TOKEN
   ```

   不要配置 `ANTHROPIC_API_KEY`、`MODEL_NAME`、`ANTHROPIC_BASE_URL`；线上站点不直接调 LLM，不做在线生成。

   访问控制：首版是内部 MVP，优先在 Vercel 打开 Deployment Protection / Team-only 访问。不要在应用里临时加简易登录、共享密码或多用户权限系统；那是下一轮正式权限改造。

   配好后由 git push、Vercel 控制台 Redeploy 或 Vercel API 触发部署。

4. **验收**：线上 `/` 与本地今日总览一致；`/card` 任意打开一张卡打分 → 本地跑 `python3 scripts/pull-feedback.py` 能拉到。

## 每天的节奏

```bash
python3 scripts/pull-feedback.py   # 跑批前：拉同事昨天打的分
# …… 入池 + 跑批（对 agent 说话，照 AGENT-PLAYBOOK.md）……
python3 scripts/sync-to-db.py --dry-run  # 跑批后：只做同步预检
```

如果无法确认 Turso 环境，或没有负责人明确授权，到 dry-run 就停止，保留本地成果和 dry-run 报告。正式同步可并入 agent 话术，但必须写清楚是“授权后同步上线”。

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
python3 scripts/sync-to-db.py --selftest     # 同步逻辑（本地 sqlite，系统临时目录）
python3 scripts/sync-to-db.py --dry-run      # 看会同步什么
python3 scripts/pull-feedback.py --selftest  # 反馈落地逻辑
npm run typecheck && npm run build           # 前端
```

## 换 / 加赛道（不改任何代码）

1. agent 入口④：7 问 → `config/tracks/<id>.json`（搜索方向写入 `bridge.search_directions`，博士定稿）。
2. `python3 scripts/sync-to-db.py --dry-run` 确认将同步内容。
3. 负责人授权后再执行 `python3 scripts/sync-to-db.py`，线上才会出现新赛道。

## 已知边界

- docs 表是全量镜像（当前约 30 份文档）；数据量大后 sync 可改增量，暂不需要。
- 线上数据新鲜度 = 最后一次被授权执行的正式 `sync-to-db.py` 时间。
- `data/runs/`（提示词渲染稿/回贴/审计材料）**不上库**，留在本地。
- 旧版 DEPLOY 提到的 `ANTHROPIC_API_KEY` / engine-bridge 实时生成已不再用于本站，无需配置。
- 没有负责人授权时，不能把正式同步写成每日默认步骤。
