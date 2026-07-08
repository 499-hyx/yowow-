# 每日运营跑批流程

目标：每天把人工跑 LLM 的操作压到 15 分钟内，并保证坏回贴永远进不了网站。

工程师主交接文档是 `docs/MVP-ARCHITECTURE-HANDOFF.md`。本文只维护日常跑批操作步骤。

如果没有 agent、只用外部 LLM 逐步跑，请读 `docs/OPERATIONS-LLM-RUNBOOK.md`。那份文档把新增账号、公共热点、赛道热点、分析提示词和回贴保存位置都列成了运营流程。

网站只读 `data/` 目录，不依赖在线 LLM。运营每天做的是：更新热点、生成提示词、把提示词交给外部 LLM、用 `ingest.py` 收回贴并安装、刷新网站。

当前是 **single-admin internal MVP**：不做登录、注册、RBAC、正式权限系统或多租户隔离。账号不再有启用/停用状态开关；只要账号 JSON 存在，并且 `account_id` / `track_id` / `platform_id` / `positioning_id` 填齐，就可以本地跑批。`track.status` 仍用于赛道审稿风险提示：非正式赛道的产物会带 `needs_human_review=true`、`formal_approval=false`、`mvp_internal_only=true`，提示“这是内部工程产物，不代表对外上线或生产同步”。

如果不想在终端里逐个保存文件，可以打开本地跑批台：

```text
http://127.0.0.1:3000/ops
```

`/ops` 只是把本页命令做成按钮和粘贴框：保存热点池、调用 `make-prompt.py`、保存 `_inbox`、调用 `ingest.py`。它不绕过 `scripts/ingest.py`，也不会执行正式 `sync-to-db.py`。使用前务必确认页面上选中的 `account_id` 和 `date`，避免把某个账号的 GPT 回贴粘到另一个账号。

---

## MVP Daily Loop

> 网站启动只代表可以读取已有 `data/today/<account_id>/latest.json`，不代表当天内容已经生成。当天内容必须按下面流程跑完并由 `ingest.py` 安装。
>
> 本章节的 14 步是权威流程；后面的“存热点 / 生成提示词 / 外部 LLM / 收回贴 / 刷新网站”是速记版。

以下示例用日期 `2026-06-29` 和账号 `acct-xiaozhu-edu-xhs`。实际执行时把日期和账号替换成当天目标。

### 1. 确认日期

```bash
cd yowow-adaptation
date +%F
```

成功标准：终端输出当天 `YYYY-MM-DD`。失败时：不要继续跑批，先统一今天要写入的日期。

### 2. 确认 track/account 可运行

```bash
python3 scripts/status.py --date 2026-06-29 --preflight acct-xiaozhu-edu-xhs
```

成功标准：目标账号文件存在且账号必要字段完整，目标赛道文件存在，公共热点池和赛道热点池存在，`prompts/分析提示词/热点匹配判断.md` / `prompts/分析提示词/内容生成.md` 模板存在，赛道 daily flow 必要字段完整。若赛道是 `paused/draft`，preflight 应显示 internal MVP warning，但不阻断本地工程验证；后续输出会标记为内部工程产物。缺账号、缺热点池、缺模板、缺必要字段仍然失败。

### 3. 检查热点池

```bash
ls data/hotspots/2026-06-29.json
ls data/hotspots/tracks/education-yowow/2026-06-29.json
python3 scripts/make-prompt.py acct-xiaozhu-edu-xhs --date 2026-06-29 --step match --no-print
```

成功标准：公共池或目标赛道池至少有一份可读热点，`make-prompt.py --step match` 能生成 `prompts/match-*.txt`。失败时：回到 Loop 1 补热点池；热点 JSON 坏或缺 `hotspot_id` 时先修热点。

### 4. 运行 status.py

```bash
python3 scripts/status.py --date 2026-06-29
```

成功标准：输出能明确列出 OK 项和 Missing 项。full status 会检查跑中/跑后产物；fresh-run 开始前缺 `prompts/`、`_inbox/`、`raw/`、`installed.json`、`manifest.json`、`today dated/latest` 是正常的，不代表不能启动 fresh-run。真正启动前以第 2 步 `--preflight` 为准；full status 在跑前主要用于列待办，失败时按 Missing 项回到对应 Loop。

### 5. 运行 match 提示词

```bash
python3 scripts/make-prompt.py acct-xiaozhu-edu-xhs --date 2026-06-29 --step match
```

成功标准：生成 `data/runs/2026-06-29/acct-xiaozhu-edu-xhs/prompts/match-<hotspot_id>.txt`。失败时：回到 Loop 0 或 Loop 1；不要手写 prompt 文件补过去。

### 6. 写入 match 回贴

```bash
mkdir -p data/runs/2026-06-29/acct-xiaozhu-edu-xhs/_inbox
```

把每个 match prompt 交给人工/agent/外部 LLM，保存为：

```text
data/runs/2026-06-29/acct-xiaozhu-edu-xhs/_inbox/match-<hotspot_id>.json
```

成功标准：每份 JSON 至少有 `hotspot_id`、`tier`、`skip_reason`；非 skip 还要有 `why_relevant`。失败时：只重答坏的 match 文件。

### 7. 运行 generate 提示词

```bash
python3 scripts/make-prompt.py acct-xiaozhu-edu-xhs --date 2026-06-29 --step generate
```

成功标准：生成 `data/runs/2026-06-29/acct-xiaozhu-edu-xhs/prompts/generate-<hotspot_id>.txt`。只对 `strong_pick/maybe` 热点作答，match 为 `skip` 的热点不生成内容。失败时：回到 Loop 2 确认 match 是否完整。

### 8. 写入 generate 回贴

把 generate prompt 交给人工/agent/外部 LLM，保存为：

```text
data/runs/2026-06-29/acct-xiaozhu-edu-xhs/_inbox/generate-<hotspot_id>.json
```

成功标准：non-skip 回贴符合 AdaptationOutput，至少 3 条 `bridge_paths`，每条都有 5 步自然逻辑链，`content` 不为空，`external_terms_check=true`。失败时：只重答坏的 generate 文件。

### 9. 运行 ingest.py

```bash
python3 scripts/ingest.py acct-xiaozhu-edu-xhs \
  data/runs/2026-06-29/acct-xiaozhu-edu-xhs/_inbox \
  --date 2026-06-29
```

成功标准：写入 `data/today/acct-xiaozhu-edu-xhs/2026-06-29.json` 和 `data/today/acct-xiaozhu-edu-xhs/latest.json`，并归档 `installed.json`、`manifest.json`、`raw/`。失败时：读错误原因，回到 Loop 2 或 Loop 3 的单条回贴，不要直接编辑 `data/today/`。

### 10. 再运行 status.py

```bash
python3 scripts/status.py --date 2026-06-29
```

成功标准：目标账号的 match/generate/today/latest 都显示 OK。失败时：按 Missing 项回到对应 Loop。

### 11. sync-to-db.py --dry-run

```bash
python3 scripts/sync-to-db.py --dry-run
```

成功标准：列出将同步的 `account/today/hotspots/config` 文档并显示总数。失败时：本地某个 JSON 损坏，先修本地文件，不要正式同步。

### 12. 可选：sync-to-db.py 正式同步

```bash
python3 scripts/sync-to-db.py
```

这不是每日必做步骤。只有在确认 Turso 指向安全 dev/test 环境，或负责人明确授权生产同步后，才允许执行正式同步。无法确认 Turso 环境时，到第 11 步 `--dry-run` 即可停止，保留本地 `data/` 成果和 dry-run 报告。

成功标准：脚本先打印正式同步风险提示，然后显示已同步到 Turso。失败时：缺 `TURSO_DATABASE_URL / TURSO_AUTH_TOKEN` 就只保留本地成果；远程错误则先不要重试覆盖，检查 Turso 状态和 dry-run 输出。

### 13. 打开页面检查

本地检查：

```bash
npm run dev
```

打开 `http://localhost:3000`，进入账号工作台和今日推荐。成功标准：账号页能读取最新内容，skip 不显示成可发草稿，页面不出现内部术语。失败时：先确认 `data/today/<account_id>/latest.json` 可读，再查前端读取层。

### 14. 第二天回拉反馈

```bash
python3 scripts/pull-feedback.py
```

本地自测：

```bash
python3 scripts/pull-feedback.py --selftest
```

成功标准：Turso `feedback_inbox` 的未处理反馈落到 `data/runs/<date>/<account_id>/feedback-inbox/` 并盖章。失败时：缺环境变量用 `--selftest` 验脚本；反馈 body 坏时人工处理该条。

---

## 1. 存热点

每天至少准备两类热点池。

公共热点池所有赛道共用，只负责全网大流量召回，不做赛道判断：

```text
data/hotspots/YYYY-MM-DD.json
```

赛道专属热点池每个已定稿赛道每天一份，用该赛道自己的 `daily_search_question` / `bridge.search_directions` 召回高相关热点：

```text
data/hotspots/tracks/<track_id>/YYYY-MM-DD.json
```

格式参考 `config/today-hotspots.demo.json`。每条至少要有：

```text
hotspot_id / title / summary / heat_score_10 / platforms
```

示例：

```bash
cd yowow-adaptation
ls data/hotspots/2026-06-10.json
ls data/hotspots/tracks/education-yowow/2026-06-10.json
```

---

## 2. 生成提示词

每个账号跑一次：

```bash
cd yowow-adaptation
python3 scripts/make-prompt.py acct-razor-douyin-boss --date 2026-06-10 --step all
```

输出位置：

```text
data/runs/2026-06-10/acct-razor-douyin-boss/prompts/match-<hotspot_id>.txt
data/runs/2026-06-10/acct-razor-douyin-boss/prompts/generate-<hotspot_id>.txt
data/runs/2026-06-10/acct-razor-douyin-boss/manifest.json
```

`make-prompt.py` 会自动合并公共池 + 该账号所属赛道的赛道池，再把账号记忆、赛道、平台、人设、热点拼进提示词；占位符替换只走白名单，示例 JSON 的花括号不会被误替换。

这一步概念上先做赛道判断，再为非 skip 热点进入赛道分析层。账号只是发布渠道。

自测：

```bash
python3 scripts/make-prompt.py --selftest
```

---

## 3. 外部 LLM

把 `prompts/` 里的每个 `.txt` 粘给外部 LLM。回贴保存到：

```text
data/runs/YYYY-MM-DD/<account_id>/_inbox/match-<hotspot_id>.json
data/runs/YYYY-MM-DD/<account_id>/_inbox/generate-<hotspot_id>.json
```

建议顺序：

```text
1. 先跑 match-*.txt，得到 strong_pick / maybe / skip
2. skip 的热点不用再跑 generate
3. strong_pick / maybe 再跑 generate-*.txt
```

文件名里的 `<hotspot_id>` 必须和热点文件一致。回贴前后有多余文字、Markdown 围栏都可以，`ingest.py` 会抽出第一个 JSON 对象。

---

## 4. 收回贴并安装

```bash
python3 scripts/ingest.py acct-razor-douyin-boss \
  data/runs/2026-06-10/acct-razor-douyin-boss/_inbox \
  --date 2026-06-10
```

如果今日页导出了反馈 JSON，把它一起归档：

```bash
python3 scripts/ingest.py acct-razor-douyin-boss \
  data/runs/2026-06-10/acct-razor-douyin-boss/_inbox \
  --date 2026-06-10 \
  --feedback ~/Downloads/today-feedback.json
```

成功后写入：

```text
data/today/<account_id>/YYYY-MM-DD.json
data/today/<account_id>/latest.json
data/runs/YYYY-MM-DD/<account_id>/installed.json
data/runs/YYYY-MM-DD/<account_id>/manifest.json
data/runs/YYYY-MM-DD/<account_id>/raw/
```

`ingest.py` 的硬门：

- JSON 抽不出来：拒收。
- match 结果缺 `tier` / `skip_reason`：拒收。
- generate 结果缺 AdaptationOutput 必填字段：拒收。
- non-skip 少于 3 条 `bridge_paths` 或桥梁 5 步缺字段：拒收。
- 回贴里的 `hotspot_id / track_id / platform_id / positioning_id` 与账号不一致：拒收。
- generate 档位高于 match 档位：自动封顶。
- 成品命中内部术语、赛道禁词、账号禁词：降级 skip，不进入可发区。

自测：

```bash
python3 scripts/ingest.py --selftest
```

---

## 5. 刷新网站

本地：

```bash
cd yowow-adaptation
npm run dev
```

打开 `http://localhost:3000`，进入账号工作台和今日推荐。

上线前建议跑：

```bash
python3 scripts/make-prompt.py --selftest
python3 scripts/ingest.py --selftest
python3 scripts/status.py --date 2026-06-10
npm run typecheck
npm run build
cd ..
python3 adaptation-core/verify.py
```

---

## 常见报错

| 报错 | 原因 | 处理 |
|---|---|---|
| `JSON 抽取失败` | LLM 回贴里没有完整 JSON，或花括号不配对 | 让 LLM 只重发 JSON；不要手工删字段 |
| `无法判断是 match 还是 generate` | 回贴既没有 `tier`，也没有 `recommendation + bridge_paths` | 确认粘的是对应 prompt 的输出格式 |
| `match 结果缺少 skip_reason` | match JSON 少字段 | 让 LLM 按 match 模板重发完整 JSON |
| `non-skip 至少需要 3 条 bridge_paths` | generate 给的桥梁不足 | 重跑 generate，要求补齐 3 条路径 |
| `bridge_paths[i] 缺 5 步字段` | 某条路径没写完整自然逻辑链 | 重跑 generate，要求每条补齐 5 个字段 |
| `track_id/platform_id/positioning_id 不一致` | 回贴串了账号，或模型自己编了 id | 检查文件名和账号；必要时重跑 prompt |
| `hotspot_id 不在 data/hotspots/YYYY-MM-DD.json 中` | 回贴对应的热点不属于当天热点文件 | 用当天 prompts 重新跑，或补齐热点文件 |
| `成品没过用词自检` | content 或桥梁外显字段命中内部词、赛道禁词、账号禁词 | 改提示词回贴中的具体外显字段，避开命中的词 |

---

## 新增账号（问卷生成 JSON，无审批、无权限系统）

当前 MVP 不做在线写库，也不需要审批。新增账号先打开 `/onboarding` 填问卷，页面会生成两份 JSON：

```text
data/accounts/<account_id>.json
config/tracks/<track_id>.json
```

这里的中文化边界要分清楚：`display_name`、`track_name`、提示词文件名和交接文档可以中文；`account_id`、`track_id` 以及由它们组成的 JSON 文件名、URL 和产物目录暂时不要改中文。它们已经是脚本参数、页面路由、`data/runs/`、`data/today/`、赛道热点池和测试夹具共同使用的主键。

页面不会直接写文件。把生成的 JSON 保存到对应路径后，再运行 preflight。已有赛道的新账号通常只需要保存账号 JSON，并把账号里的 `track_id` 改成已有赛道 ID。

账号 JSON 放入：

```text
data/accounts/<account_id>.json
```

创建后运行 `status.py --preflight <account_id>`。刷新首页后，新账号会出现在工作台，并在下一次跑批后生效。

新赛道草稿 JSON 放入：

```text
config/tracks/<track_id>.json
```

`/onboarding` 是“问卷生成 JSON”的辅助页面，不是在线注册、审批流或数据库写入。

### 问卷会问什么

问卷分两段。

赛道记忆问题：

```text
这个赛道一句话叫什么：
这个赛道主要帮谁解决问题：
产品最大的好：
客户最焦虑什么：
有哪些真实证据：
适合追哪些热点方向：
对外可以反复使用哪些人话词：
哪些词绝对不要出现在成品里：
哪些话题绝对不碰：
```

账号记忆问题：

```text
账号展示名：
主要发布平台：
出镜或表达的人设：
这个账号具体卖什么：
发内容最想达成什么：
这个账号说话应该是什么口吻：
```

### 赛道记忆真实用在哪里

这些字段不是展示用的空字段。跑批时 `scripts/make-prompt.py` 会把账号记忆叠加到赛道配置，形成生效的 `effective_track`：

```text
data/accounts/<account_id>.json memory
  + config/tracks/<track_id>.json
  → effective_track
  → match 用 account_match_card
  → generate 用 track_json
```

然后它会以两种形态进入日常提示词：

```text
prompts/分析提示词/热点匹配判断.md
  使用短账号判断卡，用于判断 strong_pick / maybe / skip

prompts/分析提示词/内容生成.md
  使用完整 track_json，用于生成桥梁路径、标题、正文/脚本和风险提醒
```

具体映射：

```text
anxiety_anchors → match 判断热点是否戳中客户焦虑；generate 生成真实问题
product_value → generate 落产品价值
proof_assets → generate 禁止编证据，只能用真实证据
bridge.external_vocab → generate 用对外人话搭桥
bridge.forbidden_terms + extra_forbidden_terms → ingest 成品禁词硬门
bridge.search_directions / daily_search_question → 准备赛道热点池时使用
```

保存后跑：

```bash
python3 scripts/status.py --date 2026-06-29 --preflight acct-<name>-<platform>
```

### 人工回贴模板

格式权威来源：

- match 回贴格式以 `prompts/分析提示词/热点匹配判断.md` 和 `scripts/ingest.py` 为准。
- generate 回贴格式以生成的 `generate-*.txt`、`prompts/分析提示词/内容生成.md` 和 `scripts/ingest.py` 为准。
- 下面示例只作为最小参考。

match 回贴最小可接收模板：

```json
{
  "tier": "strong_pick",
  "relevance_score": 8.0,
  "naturalness_score": 8.0,
  "why_relevant": "<为什么这个热点和账号有关>",
  "skip_reason": null
}
```

skip 回贴最小可接收模板：

```json
{
  "tier": "skip",
  "relevance_score": 2.0,
  "naturalness_score": 2.0,
  "why_relevant": "",
  "skip_reason": "<为什么别蹭>"
}
```

文件名必须是 `match-<hotspot_id>.json`；如果 JSON 里写了 `hotspot_id`，必须和文件名一致。

generate 回贴不要手写结构，优先让外部 LLM 按 `prompts/分析提示词/内容生成.md` 输出完整 JSON；手写很容易漏 `bridge_paths` 的 5 步链。

## 修改账号记忆

直接编辑：

```text
data/accounts/<account_id>.json
```

修改 `memory` 字段后保存。下次跑 `make-prompt.py` 时，新记忆会自动进入提示词。

## 新赛道接入不是每日流程

新赛道第一次接入才使用：

```text
prompts/新增账号与赛道接入/新赛道桥梁母题.md
prompts/新增账号与赛道接入/新赛道热点搜索方向.md
```

赛道定稿后，daily flow 不再依赖这两个 bridge 提示词。每日状态检查只看公共池、赛道池、赛道配置必要字段、判断/分析输出和 `data/today` 安装结果。
