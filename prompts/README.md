# prompts/ 提示词路由表

这一层只放给人改的提示词。代码负责读模板、填变量、写运行产物；不要把方法论散到脚本里。

当前按用途分成 5 类：

```text
prompts/
  公共热点/              公共池提示词，结果进入 data/hotspots/<date>.json
  赛道热点/              赛道池搜索提示词，结果进入 data/hotspots/tracks/<track_id>/<date>.json
  分析提示词/            match、generate、各赛道分析层
  新增账号与赛道接入/    onboarding、新账号 JSON、新赛道母题和搜索方向起草
  归档/                  历史提示词，只作追溯
```

## 当前主链路

```text
公共热点提示词
  -> /ops 复制给外部 LLM
  -> 粘回 /ops
  -> data/hotspots/<date>.json

赛道热点提示词
  -> /ops 复制给外部 LLM
  -> 粘回 /ops
  -> data/hotspots/tracks/<track_id>/<date>.json

scripts/make-prompt.py --step match
  -> prompts/分析提示词/热点匹配判断.md
  -> data/runs/<date>/<account_id>/prompts/match-*.txt
  -> _inbox/match-*.json

scripts/make-prompt.py --step generate
  -> prompts/分析提示词/内容生成.md
  -> prompts/分析提示词/<track_id>/赛道分析.md
  -> data/runs/<date>/<account_id>/prompts/generate-*.txt
  -> _inbox/generate-*.json

scripts/ingest.py
  -> data/today/<account_id>/<date>.json
  -> data/today/<account_id>/latest.json
```

## 文件路由表

| 文件 / 目录 | 当前角色 | 谁读取它 |
|---|---|---|
| `公共热点/来源注册/<中文名>.md` | 公共热点来源注册；`enabled:true` 会出现在 `/ops` 复制卡片 | `lib/ops-workbench.ts` |
| `公共热点/平台原生全网热点.md` | 默认公共热点正文 | `公共热点/来源注册/平台原生全网热点.md` 通过 `source_file` 引用 |
| `公共热点/终极雷达热点.md` | 硬核公共热点正文 | `公共热点/来源注册/终极雷达热点.md` 通过 `source_file` 引用 |
| `赛道热点/<track_id>/热点搜索.md` | 赛道专属热点搜索 | `/ops` 优先读取 |
| `赛道热点/通用赛道热点搜索.md` | 赛道搜索兜底模板 | 没有赛道专属搜索时读取 |
| `分析提示词/热点匹配判断.md` | 判断热点能不能发，输出 `match-*.json` 合约 | `scripts/make-prompt.py` |
| `分析提示词/内容生成.md` | 生成桥梁路径和内容草稿，输出 `generate-*.json` 合约 | `scripts/make-prompt.py` |
| `分析提示词/<track_id>/赛道分析.md` | 赛道专属分析层，注入 generate prompt | `make-prompt.py` / `answer.py` |
| `分析提示词/每日总结.md` | 可选，把 latest 翻译成老板看的三段话 | 人工 / agent |
| `新增账号与赛道接入/新增账号与赛道JSON草稿.md` | 新账号 / 新赛道 JSON 草稿 | 人工 / agent |
| `新增账号与赛道接入/新赛道桥梁母题.md` | 新赛道桥梁母题起草 | 人工 / agent |
| `新增账号与赛道接入/新赛道热点搜索方向.md` | 新赛道搜索方向起草 | 人工 / agent |
| `归档/*` | 历史提示词 | 当前主链路不读取 |

## 新增公共热点来源

新增文件：

```text
prompts/公共热点/来源注册/<中文名>.md
```

最小格式：

```markdown
---
id: people-voices
title: 人物言论雷达
enabled: true
description: 抓 AI / 科技 / 教育 / 商业关键人物公开言论
---

今天是 {date}。

只输出可直接保存到公共热点池的 JSON 数组，不要 Markdown，不要解释。
```

如果只是给已有长 prompt 做卡片注册，可以不复制正文：

```markdown
---
id: platform-native
title: 平台原生全网热点
enabled: true
source_file: ../平台原生全网热点.md
---

这里的正文只是给人看的说明；复制给 LLM 的内容来自 source_file。
```

规则：

- 文件名尽量用中文，`id` 保持小写英文、数字、短横线，这是机器稳定标识。
- `enabled:false` 表示临时隐藏，不删除文件。
- `{date}` 会由系统自动替换。
- 公共热点只提供所有赛道共享的真实原料，不做赛道判断。

## 新增账号与赛道接入

新增账号和新赛道先分清两件事：

```text
账号记忆：这个号卖什么、给谁、怎么说、哪些禁区不能碰
赛道记忆：这类生意如何判断热点、搜什么热点、怎么自然连接到产品价值
```

可中文化的部分：

- prompt 文件名和目录名。
- `display_name`、`track_name`、`platform_name`、`positioning_name`。
- 文档、注释、人工交接说明。

暂时不要中文化的部分：

- `account_id` 和 `track_id`。
- `data/accounts/<account_id>.json`、`config/tracks/<track_id>.json`、`data/today/<account_id>/...` 这些机器路径。
- `prompts/赛道热点/<track_id>/...` 和 `prompts/分析提示词/<track_id>/...` 中的 `<track_id>` 目录。

原因：这些 ID 同时是脚本参数、URL 参数、今日产物目录、热点池目录和测试夹具。直接改中文会牵动全链路，不是简单重命名。

新增账号 / 新赛道辅助提示词：

| 文件 | 用途 | 产物 |
|---|---|---|
| `新增账号与赛道接入/新增账号与赛道JSON草稿.md` | 根据问卷起草账号 JSON；新赛道时同时起草赛道 JSON 草稿 | `data/accounts/<account_id>.json` / `config/tracks/<track_id>.json` |
| `新增账号与赛道接入/新赛道桥梁母题.md` | 给新赛道起草后台判断视角、对外人话词、禁词和桥梁样例 | 写回 `config/tracks/<track_id>.json` 的 `bridge` / `example_bridges` |
| `新增账号与赛道接入/新赛道热点搜索方向.md` | 给新赛道起草赛道热点搜索方向 | 写回 `config/tracks/<track_id>.json` 的 `daily_search_question` / `bridge.search_directions` |

## 新增赛道提示词

新增赛道最小文件：

```text
config/tracks/<track_id>.json
data/accounts/<account_id>.json
prompts/赛道热点/<track_id>/热点搜索.md
prompts/分析提示词/<track_id>/赛道分析.md
```

两种赛道提示词作用不同：

| 类型 | 放哪里 | 输出到哪里 |
|---|---|---|
| 赛道热点搜索 | `prompts/赛道热点/<track_id>/热点搜索.md` | `data/hotspots/tracks/<track_id>/<date>.json` |
| 赛道分析层 | `prompts/分析提示词/<track_id>/赛道分析.md` | 注入 `data/runs/<date>/<account_id>/prompts/generate-*.txt` |

## 修改后怎么验

| 改动 | 必跑 |
|---|---|
| 改 `分析提示词/热点匹配判断.md` | `python3 scripts/make-prompt.py --selftest` |
| 改 `分析提示词/内容生成.md` | `python3 scripts/make-prompt.py --selftest` + `python3 scripts/ingest.py --selftest` |
| 改公共热点来源 | `npm run test` 或至少跑 `test/ops-workbench.test.mjs` |
| 改赛道热点搜索 | 刷新 `/ops` 看提示词是否出现；保存一条测试热点后跑 preflight |
| 改赛道分析层 | 跑 `python3 scripts/make-prompt.py <account_id> --date <date> --step generate --no-print`，检查生成文件是否含新分析层 |

## 红线

- 牵强即 `skip`，不要硬生成。
- 内部分析术语不能进入用户可见内容。
- 成品不能出现赛道或账号禁词。
- 不编造热点事实、来源、证据或效果。
- 不绕过 `scripts/ingest.py` 写 `data/today/<account_id>/latest.json`。
