# yowow-adaptation

本项目是一个**多赛道热点适配系统**。它不是单纯的热点采集工具，也不是普通 AI 写作工具。

每天要回答的是：

1. 今天哪些热点值得这个账号发？
2. 这个热点怎么和这个账号的业务自然连接，而不是硬蹭？
3. 能不能给一版可发布草稿？

## 先读什么

接手整个 workspace 先读根目录 `交接文档/00-先看这里-交接入口.md`。只接手 `yowow-adaptation/` 子项目时，再读 `docs/README.md`。

最常用入口：

- 工程师项目全图：`../交接文档/01-工程师项目全图.md`
- 工程师第一天接手：`../交接文档/02-第一天接手清单.md`
- 日常跑批流程：`../交接文档/03-日常跑批流程.md`
- 提示词和热点入口：`../交接文档/04-提示词和热点入口.md`
- 跑批闭环专项：`../交接文档/附录/08-跑批闭环专项.md`
- 工程详细源文档：`docs/MVP-ARCHITECTURE-HANDOFF.md`
- 每日跑批：`docs/RUNBOOK.md`
- 外部 LLM 运营闭环：`docs/OPERATIONS-LLM-RUNBOOK.md`
- 代码模块：`docs/CODE-MAP.md`
- 提示词：`prompts/README.md`
- 普通同事：`docs/同事使用指南.md`

## 核心原则

- 热点是公共原料，放在 `data/hotspots/`。
- 适配结果由赛道、平台、账号定位、账号记忆和历史反馈共同决定。
- 牵强则跳过，`skip` 比硬生成更重要。
- 非跳过内容必须给出自然连接路径和可发布草稿。
- 用户可见内容不能暴露内部分析术语。
- 新增赛道主要通过配置完成。
- 新增赛道主要通过 `config/tracks/<track_id>.json` 完成，不改核心引擎。

## 目录

```text
app/                    Next.js App Router 页面和 API
components/adaptation/  工作台 UI 组件
config/
  tracks/               赛道配置：方法论、禁词、搜索方向、自然连接样例
  platforms/            平台配置：表达形态、标题规则、平台禁忌
  positionings/         人设配置
  account-profiles/     种子账号配置
data/
  accounts/             真实账号档案和账号记忆
  hotspots/             公共热点池与赛道定向热点池
  today/                已安装的每日推荐结果，网站只读这里
  runs/                 每日跑批提示词、回贴和安装记录
docs/                   工程交接、RUNBOOK、验收和归档文档
lib/                    前端/服务端共享类型、读取层、适配展示和 skip gate
prompts/                可编辑提示词模板
scripts/                跑批、验收、同步、配置校验脚本
test/                   Node test 回归测试和 golden tests
```

## 日常跑批

本地文件是事实源。网站默认读 `data/` + `config/`，不依赖在线 LLM。

没有 agent 时，运营按 `docs/OPERATIONS-LLM-RUNBOOK.md` 跑：从新增账号、公共热点、赛道热点、match、generate 到 ingest，逐步复制提示词给外部 LLM。

```bash
npm install
npm run dev
```

每天跑批按 `docs/RUNBOOK.md`：

```bash
python3 scripts/make-prompt.py <account_id> --date <YYYY-MM-DD> --step match
python3 scripts/make-prompt.py <account_id> --date <YYYY-MM-DD> --step generate
python3 scripts/ingest.py <account_id> data/runs/<YYYY-MM-DD>/<account_id>/_inbox --date <YYYY-MM-DD>
```

`ingest.py` 是唯一有资格安装 `data/today/` 的入口。它会拒收结构错误的回贴，并把命中禁词或内部术语的成品降级为 skip。

## 新增账号与赛道

新增账号优先写：

```text
data/accounts/<account_id>.json
```

账号只放业务事实和记忆，不保存赛道方法论副本。文件名里的 `account_id` 保持英文短横线格式；中文展示名写在 `display_name`。

只有现有赛道无法复用时，才新增或修改：

```text
config/tracks/<track_id>.json
```

赛道配置里写目标用户、业务目标、适合/不适合的热点类型、自然连接方式、禁词、跳过规则和搜索方向。新增赛道还要补：

```text
prompts/赛道热点/<track_id>/热点搜索.md
prompts/分析提示词/<track_id>/赛道分析.md
```

第一次接入可用 `prompts/新增账号与赛道接入/` 下的中文提示词起草。

## 验证

改完至少跑：

```bash
npm run typecheck
npm run test:golden
node --test test/*.test.mjs
python3 scripts/make-prompt.py --selftest
python3 scripts/ingest.py --selftest
cd ..
python3 adaptation-core/verify.py
```

部署说明见 `DEPLOY.md`。日常运营说明见 `AGENT-PLAYBOOK.md` 和 `docs/RUNBOOK.md`。
