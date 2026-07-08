# 运营外部 LLM 业务闭环手册

本文给运营使用：即使没有 agent，也能找到提示词，把内容生产闭环一步一步跑完。

工程规则仍然是：

- 本地 `data/ + config/` 是事实源。
- 外部 LLM 只负责回答提示词，不直接写网站。
- `scripts/ingest.py` 是唯一安装 `data/today/<account_id>/latest.json` 的入口。
- 正式 `scripts/sync-to-db.py` 不默认执行；日常只做 `--dry-run`。

以下命令默认在 `yowow-adaptation/` 目录下执行。

---

## 0. 总流程

```text
新增账号 / 新赛道
  -> prompts/新增账号与赛道接入/新增账号与赛道JSON草稿.md
  -> prompts/新增账号与赛道接入/新赛道桥梁母题.md
  -> prompts/新增账号与赛道接入/新赛道热点搜索方向.md
  -> 手动保存 JSON 到 data/accounts/ 和 config/tracks/
  -> python3 scripts/status.py --date <date> --preflight <account_id>

每日公共热点
  -> prompts/公共热点/平台原生全网热点.md
  -> 可选 prompts/公共热点/终极雷达热点.md
  -> 保存到 data/hotspots/<date>.json

每日赛道热点
  -> prompts/赛道热点/<track_id>/热点搜索.md
  -> 保存到 data/hotspots/tracks/<track_id>/<date>.json

每日账号内容
  -> python3 scripts/make-prompt.py <account_id> --date <date> --step match
  -> 外部 LLM 回答 match-*.txt
  -> 保存到 data/runs/<date>/<account_id>/_inbox/match-*.json
  -> python3 scripts/make-prompt.py <account_id> --date <date> --step generate
  -> 外部 LLM 回答 generate-*.txt，可同时参考 prompts/分析提示词/<track_id>/赛道分析.md
  -> 保存到 data/runs/<date>/<account_id>/_inbox/generate-*.json
  -> python3 scripts/ingest.py <account_id> data/runs/<date>/<account_id>/_inbox --date <date>
  -> python3 scripts/status.py --date <date>
  -> python3 scripts/sync-to-db.py --dry-run
```

---

## 1. 新增账号怎么做

### 1.1 收集问卷答案

先让老板/同事回答这些问题：

```text
1. 账号叫什么？
2. 卖什么 / 服务什么？
3. 卖给谁？
4. 产品最大的好是什么？
5. 有什么证据？例如案例、实拍、检测、资质、数据、用户反馈。
6. 客户最焦虑什么？
7. 什么内容一定不能碰？
8. 用什么平台？小红书 / 抖音 / 视频号 / B站 / YouTube。
9. 用什么人设？老板型 / 专家型 / 工厂源头型。
10. 说话风格是什么？
```

### 1.2 用外部 LLM 起草账号 JSON

复制这个提示词：

```text
prompts/新增账号与赛道接入/新增账号与赛道JSON草稿.md
```

把问卷答案粘进去，让外部 LLM 输出：

```text
data/accounts/<account_id>.json
config/tracks/<track_id>.json 草稿
```

如果是已有赛道，只保存账号 JSON；如果是新赛道，再保存赛道 JSON 草稿。

注意：中文名写进 `display_name` / `track_name`。`account_id`、`track_id` 和对应文件名保持英文短横线格式；它们是脚本、URL、热点池、today 结果和测试共用的机器主键。

### 1.3 新赛道要补桥梁母题和搜索方向

如果是新赛道，继续用：

```text
prompts/新增账号与赛道接入/新赛道桥梁母题.md
prompts/新增账号与赛道接入/新赛道热点搜索方向.md
```

输出结果由负责人/博士复核后，补进：

```text
config/tracks/<track_id>.json
```

当前 MVP 不要求网页自动保存账号。`/onboarding` 可以辅助生成 JSON 草稿，但最后仍由管理员手动保存文件。

### 1.4 保存后跑 preflight

```bash
python3 scripts/status.py --date 2026-06-29 --preflight <account_id>
```

通过标准：

```text
Missing / action needed:
  (none)
```

如果缺赛道热点池，先按第 3 步准备。

---

## 2. 每天怎么搜公共热点

公共热点是所有赛道共享的原料，不带任何行业倾向。

### 2.1 复制公共热点提示词

```text
prompts/公共热点/平台原生全网热点.md
```

公共热点不只有一个来源。日常至少可以选：

```text
prompts/公共热点/来源注册/*.md      # 后续新增的公共热点来源，/ops 自动展示
prompts/公共热点/平台原生全网热点.md           # 平台原生全网热点，偏普通人正在讨论什么
prompts/公共热点/终极雷达热点.md  # 终极雷达热点，偏范式转移级硬核情报
```

把 `{date}` 替换成当天日期，例如：

```text
2026-06-29
```

交给外部 LLM。提示词已经内置系统热点池字段，要求它只输出 JSON 数组。多个公共热点提示词的结果可以合并后一起粘贴保存；系统会按 `hotspot_id` 读取，缺 ID 时会自动补。

新增公共热点提示词时，不需要改代码。把文件放到：

```text
prompts/公共热点/来源注册/<中文名>.md
```

并在文件头写 `id`、`title`、`enabled`。刷新 `/ops` 后会自动出现复制卡片。临时隐藏时把 `enabled` 改成 `false`。

### 2.2 检查输出可以直接入池

LLM 返回结果应该已经是可直接保存的热点池 JSON。不要再单独跑整理步骤；如果字段缺失，回到对应的公共热点提示词让外部 LLM 按原 schema 重答。

### 2.3 保存公共热点池

保存到：

```text
data/hotspots/<date>.json
```

例如：

```text
data/hotspots/2026-06-29.json
```

热点池最终每条至少长这样：

```json
{
  "id": "hs-20260629-001",
  "hotspot_id": "hs-20260629-001",
  "date": "2026-06-29",
  "source_skill": "external-llm-manual",
  "source_direction": "broad",
  "scope": "broad",
  "title": "<热点标题>",
  "summary": "<客观概述>",
  "why_now": "<为什么现在有热度>",
  "phenomenon": "<客观现象>",
  "spread_emotion": "<传播情绪>",
  "people_involved": ["<涉及人群>"],
  "conflict_point": "<冲突点>",
  "fact_structure": "<事实结构>",
  "candidate_problem_dimensions": ["<问题维度1>", "<问题维度2>"],
  "heat_score_10": 8.0,
  "traffic_level": "medium",
  "platforms": ["小红书", "抖音"],
  "source_notes": ["<来源线索>"],
  "source_url": "<可选 URL>",
  "risk_notes": ["公共池只记录大盘热度，不做赛道推荐判断。"]
}
```

`hotspot_id` 由运营按日期顺序编号，建议格式：

```text
hs-YYYYMMDD-001
hs-YYYYMMDD-002
```

不要新增外部事实。来源不清楚的热点宁可不入池。

---

## 3. 每天怎么搜赛道专属热点

赛道热点是“这个赛道更可能接得住”的定向原料。

### 3.1 先找到赛道提示词

```text
prompts/赛道热点/<track_id>/热点搜索.md
```

当前已有：

```text
prompts/赛道热点/education-yowow/热点搜索.md
prompts/赛道热点/razor-personalcare/热点搜索.md
prompts/赛道热点/petfood-sourcing/热点搜索.md
prompts/赛道热点/fitness-coaching/热点搜索.md
```

把 `{date}` 替换成当天日期后，交给外部 LLM。提示词已经内置系统热点池字段，要求它只输出 JSON 数组。

### 3.2 保存赛道热点池

LLM 返回结果应该已经是可直接保存的赛道热点池 JSON。保存到：

```text
data/hotspots/tracks/<track_id>/<date>.json
```

例如：

```text
data/hotspots/tracks/razor-personalcare/2026-06-29.json
```

赛道热点池每条格式和公共池一致，只改：

```json
{
  "source_direction": "<track_id>",
  "scope": "track:<track_id>",
  "track_notes": ["<为什么适合这个赛道池，仅作入池备注>"]
}
```

示例：

```json
{
  "id": "hs-20260629-razor-001",
  "hotspot_id": "hs-20260629-razor-001",
  "date": "2026-06-29",
  "source_skill": "external-llm-manual",
  "source_direction": "razor-personalcare",
  "scope": "track:razor-personalcare",
  "title": "<热点标题>",
  "summary": "<客观概述>",
  "phenomenon": "<客观现象>",
  "spread_emotion": "<传播情绪>",
  "candidate_problem_dimensions": ["<问题维度1>", "<问题维度2>"],
  "heat_score_10": 7.0,
  "platforms": ["抖音"],
  "source_notes": ["<来源线索>"],
  "track_notes": ["这条只说明它适合进入赛道池，不代表一定推荐发布。"]
}
```

### 3.3 找不到合适热点怎么办

直接保存空数组也可以：

```json
[]
```

不要为了凑数编造热点。当天没有赛道热点时，仍可用公共热点池跑 match。

---

## 4. 每天怎么判断热点能不能发

### 4.1 跑 match prompt

```bash
python3 scripts/make-prompt.py <account_id> --date <date> --step match
```

输出在：

```text
data/runs/<date>/<account_id>/prompts/match-<hotspot_id>.txt
```

### 4.2 外部 LLM 回答 match

逐个打开 `match-*.txt`，复制给外部 LLM。

保存回答到：

```text
data/runs/<date>/<account_id>/_inbox/match-<hotspot_id>.json
```

match 最小 JSON：

```json
{
  "tier": "strong_pick",
  "relevance_score": 8.0,
  "naturalness_score": 8.0,
  "why_relevant": "这条热点戳中的真实焦虑，能自然接到这个账号的客户问题。",
  "skip_reason": null
}
```

skip 最小 JSON：

```json
{
  "tier": "skip",
  "relevance_score": 2.0,
  "naturalness_score": 2.0,
  "why_relevant": "",
  "skip_reason": "这条热度虽高，但跟这个账号的生意关系弱，硬接会显得牵强。"
}
```

---

## 5. 每天怎么生成内容

### 5.1 跑 generate prompt

```bash
python3 scripts/make-prompt.py <account_id> --date <date> --step generate
```

输出在：

```text
data/runs/<date>/<account_id>/prompts/generate-<hotspot_id>.txt
```

只处理 match 为 `strong_pick` 或 `maybe` 的热点。`skip` 不要生成。

### 5.2 找到赛道分析提示词

同时打开：

```text
prompts/分析提示词/<track_id>/赛道分析.md
```

当前已有：

```text
prompts/分析提示词/education-yowow/赛道分析.md
prompts/分析提示词/razor-personalcare/赛道分析.md
prompts/分析提示词/petfood-sourcing/赛道分析.md
prompts/分析提示词/fitness-coaching/赛道分析.md
```

用法：

1. 把 `generate-*.txt` 复制给外部 LLM。
2. 再补一句：`请同时遵守下面这份赛道分析层提示词。`
3. 粘贴对应 `prompts/分析提示词/<track_id>/赛道分析.md`。
4. 要求外部 LLM 只输出 JSON。

generate 的完整格式以 `generate-*.txt` 里的 schema 为准，不要自己简化。

---

## 6. 收回贴并安装到网站

```bash
python3 scripts/ingest.py <account_id> data/runs/<date>/<account_id>/_inbox --date <date>
```

成功后会写：

```text
data/today/<account_id>/<date>.json
data/today/<account_id>/latest.json
data/runs/<date>/<account_id>/installed.json
data/runs/<date>/<account_id>/manifest.json
data/runs/<date>/<account_id>/raw/
```

然后检查：

```bash
python3 scripts/status.py --date <date>
python3 scripts/sync-to-db.py --dry-run
```

打开网站：

```bash
npm run dev
```

```text
http://127.0.0.1:3000
```

---

## 7. 运营每天只要记住这张表

| 要做什么 | 找哪个提示词 / 命令 | 产物放哪里 |
|---|---|---|
| 新增账号 | `prompts/新增账号与赛道接入/新增账号与赛道JSON草稿.md` | `data/accounts/<account_id>.json` |
| 新赛道桥梁母题 | `prompts/新增账号与赛道接入/新赛道桥梁母题.md` | `config/tracks/<track_id>.json` |
| 新赛道搜索方向 | `prompts/新增账号与赛道接入/新赛道热点搜索方向.md` | `config/tracks/<track_id>.json` |
| 搜公共热点 | `prompts/公共热点/来源注册/*.md`、`prompts/公共热点/平台原生全网热点.md` | `data/hotspots/<date>.json` |
| 搜赛道热点 | `prompts/赛道热点/<track_id>/热点搜索.md` | `data/hotspots/tracks/<track_id>/<date>.json` |
| 判断能不能发 | `scripts/make-prompt.py --step match` 生成的 `match-*.txt` | `_inbox/match-*.json` |
| 生成内容 | `scripts/make-prompt.py --step generate` 生成的 `generate-*.txt` + `prompts/分析提示词/<track_id>/赛道分析.md` | `_inbox/generate-*.json` |
| 安装结果 | `scripts/ingest.py` | `data/today/<account_id>/latest.json` |
| 同步预检 | `scripts/sync-to-db.py --dry-run` | 只打印报告 |

---

## 8. 禁止事项

- 不要让外部 LLM 直接改 `data/today/`。
- 不要绕过 `scripts/ingest.py`。
- 不要把 `sync-to-db.py` 正式同步当成日常默认步骤。
- 不要编造热点、来源、证据、检测报告、用户反馈。
- 不要在成品里写内部术语或赛道禁词。
- 牵强就 `skip`，不要硬生成。
