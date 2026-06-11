# yowow-adaptation · 多赛道内容桥梁系统（独立站）

每天告诉一个赛道老板：**今天发什么、怎么讲不牵强、并给一条好草稿。**
独立 Next.js 应用 + 独立 Vercel 项目，**与小朱 `yowow-content-board` 彻底分开**。

## 它怎么工作

本地 agent 跑批：热点入池 → `make-prompt` → agent 作答 → `ingest` 硬门收口 → 写 `data/today/`。
网站只展示文件结果：本地读 `data/` + `config/`，线上读 Turso 镜像；同事反馈写入 `feedback_inbox`，再拉回本地归档。

每个需要「思考」的环节，提示词都外置在 `prompts/*.md`，博士 / 老板可直接改，不碰代码。网站本身不调 LLM。

## 目录

```
app/                  Next.js App Router（今日总览、热点池、账号、赛道、卡片、反馈）
components/adaptation/ 工作台 UI 组件
lib/
  data-source.ts      双源读取层：无 Turso 环境变量读文件，有 Turso 环境变量读库
  turso.ts            零依赖 Turso HTTP 客户端
  adaptation-types.ts / dashboard-data.ts / file-data.ts
prompts/              ★可编辑提示词层★（见 prompts/README.md）
config/               赛道 / 平台 / 定位 / 账号配置
data/                 本地事实源：热点池、账号、今日推荐
db/                   Turso schema
scripts/              make-prompt / ingest / sync-to-db / pull-feedback
.env.example          环境变量样例
DEPLOY.md             部署到独立 Vercel 项目的照抄清单
```

## 本地跑

```bash
npm install
npm run dev      # http://localhost:3000
```

本地默认不需要环境变量，直接读 `data/` + `config/`。线上只配置 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`。

## 改提示词 / 换赛道

- 改方法论 / 口吻：编辑 `prompts/*.md`（步骤见 `prompts/README.md`）。
- 换 / 加赛道：加 `config/tracks/<id>.json` + `config/bridge-directions/<id>.json`，**不改网站代码**。

## 部署

见 `DEPLOY.md`。⛔ 绝不用 `vercel deploy` CLI；绝不部署到 `yowow-content-board`。
