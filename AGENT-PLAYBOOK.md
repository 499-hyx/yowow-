# AGENT-PLAYBOOK.md — yowow-adaptation 日常使用协议（四入口）

> 本文件管**日常运营跑批**，给 Claude Code / Codex 等 agent 在每天出内容时照做。
> 仓库施工（改代码、做工单）另有规范：根目录 `AGENTS.md` + `adaptation-core/BUILD-SPEC.md`，施工铁律优先于本文件。
> 本文件描述的所有动作均**不改代码、不改 prompts 正文、不改 schemas、不碰旧小朱看板**。

---

## 心智模型（先读这四句）

1. **账号是主语，赛道是配置，热点是中立原料，文件是唯一接口。**
2. 网站只读 `yowow-adaptation/data/`；agent 的全部工作就是围着 `data/` 读文件、答提示词、写文件。
3. agent 自己就是 RUNBOOK 第 3 步那个「外部 LLM」：读 `prompts/*.txt` 当场作答，回贴写进 `raw/`，由 `ingest.py` 硬门收口。
4. 用户最终只关心三件事：**这个账号今天该发什么、为什么能发、哪些别蹭。** 每次跑完必须用人话回答这三件事。

**禁用旧心智**：本目录下的任何对话和产物中，不使用「流1」「流2」「流3」「流4」「家长选题」「影视雷达」等来源视角的词。旧抓取 skill 若仍在运行，仅视为热点池的可选供货商，其产物必须先整理成热点池标准 JSON 字段，才能进 `data/hotspots/`，绝不直接喂给账号。

---

## 话术 → 入口映射（用户怎么说，agent 怎么做）

| 用户话术 | 入口 |
|---|---|
| 「抓今天的热点」 | 入口① |
| 「<账号名>今天发什么」「给剃须刀号跑今日推荐」 | 入口② |
| 「所有账号今天发什么」 | 入口③ = 遍历入口② |
| 「新增一个账号：……」「接一个新赛道：……」 | 入口④ |
| 「给 <赛道> 重写搜索方向」 | 入口④ 第 2 步单独重跑 |
| 「今天一条龙」 | 入口① + 入口③ |

所有命令在 `yowow-adaptation/` 目录下执行。日期统一 `YYYY-MM-DD`，默认今天。

---

## 每一步的固定提示词（心路历程全程可审计）

每个判断步骤都有固定模板，agent **不许自由发挥提示词**。想改模型的判断方式 = 改对应模板的「可编辑区」，不是改 agent 行为。每次渲染后的完整提示词和模型回答都必须落盘，事后可逐条复查。

| 步骤 | 模板 | 谁渲染 | 渲染稿 / 回答存档 |
|---|---|---|---|
| 入口①a 大盘扫描（公共池） | `prompts/公共热点/平台原生全网热点.md` | agent 手工填占位 | `data/runs/<D>/_hotspot-pool/prompts\|raw/broad.*` |
| 入口①b 赛道定向搜索（赛道池） | `prompts/赛道热点/通用赛道热点搜索.md` | agent 手工填占位 | `data/runs/<D>/_hotspot-pool/prompts\|raw/search-<track_id>.*` |
| 入口② 筛选 match | `prompts/分析提示词/热点匹配判断.md` | `make-prompt.py` 自动 | 提示词 `prompts/match-<hotspot_id>.txt`；待安装回贴 `_inbox/match-<hotspot_id>.json`；ingest 后归档到 `raw/` |
| 入口② 生成 generate | `prompts/分析提示词/内容生成.md` | `make-prompt.py` 自动 | 提示词 `prompts/generate-<hotspot_id>.txt`；待安装回贴 `_inbox/generate-<hotspot_id>.json`；ingest 后归档到 `raw/` |
| 入口② 人话汇总 | `prompts/分析提示词/每日总结.md` | agent 手工填占位 | 可选 `data/runs/<D>/<acct>/summary.md` |
| 入口④ 桥梁母题 | `prompts/新增账号与赛道接入/新赛道桥梁母题.md` | agent 手工填占位 | `data/runs/<D>/_onboarding/<track_id>/prompts\|raw/motif.*` |
| 入口④ 搜索方向（写进 tracks 文件） | `prompts/新增账号与赛道接入/新赛道热点搜索方向.md` | agent 手工填占位 | `data/runs/<D>/_onboarding/<track_id>/prompts\|raw/directions.*` |

把控点分工：**博士**改 hotspot-search / hotspot-match / bridge-motif / bridge-directions 的可编辑区（判断口径与方法论）；**老板/运营**改 content-generate 的口吻结构区和 daily-summary 的详略口吻。模板头注说明各自的占位符与存档位置。

---

## 入口① 抓今日热点（两池架构：公共池 + 赛道池）

> **两池铁律**：中立与否不在内容，在「谁选的」。用赛道母题搜出来的料，永远只进该赛道池；
> 公共池只放无任何行业偏向的大盘扫描结果。外部跑的定向研究报告（如 GPT deep research）
> 也是赛道池的进货渠道，**绝不入公共池**。

**①a 大盘扫描 → 公共池**（每天一次）
- 渲染 `prompts/公共热点/平台原生全网热点.md`（无赛道字眼，多方向扫描）作答，直接输出热点池标准 JSON。
- 写 `data/hotspots/YYYY-MM-DD.json`，每条 `scope: "broad"`。

**①b 赛道定向搜索 → 赛道池**（每个 active 赛道各一次）
- 读 `config/tracks/<track_id>.json` 的 `bridge.search_brief + search_directions` → 渲染 `prompts/赛道热点/通用赛道热点搜索.md` 作答，直接输出热点池标准 JSON。
- 写 `data/hotspots/tracks/<track_id>/YYYY-MM-DD.json`，每条 `scope: "track:<track_id>"`。

「抓今天的热点」= ①a + 全部赛道的 ①b + ①c；「只给 <赛道> 抓热点」= 只跑该赛道 ①b。

### 入口①c 处理灵感收件箱（owner spark）

每天跑热点前，先检查 `data/spark-inbox/<account_id>/` 的 pending 条目。
pending spark 只作为该账号赛道池的进货线索，绝不进公共池。
- 能找到外部素材的：按入口①b 搜索格式整理后入赛道池，必须挂真实 `source_url`；
- 纯自命题但足以支撑剖析的：允许 `source_url` 为空，标 `source_skill: "owner-spark"`；
- 查无实据或撑不起剖析的：spark 标 rejected，写人话 `reject_reason`（铁律：缺料不捏造）。
所有 spark 入池条目一律带 `source_direction: "owner-spark:<spark_id>"`（追溯）。
处理完成后给 spark 盖章：`status: ingested/rejected` + `resolved_at`，
ingested 记录关联的 `hotspot_id`。

每条字段照 `config/today-hotspots.demo.json`：

```text
必填：hotspot_id / date / title / summary / heat_score_10 / platforms / scope
富化：phenomenon / spread_emotion / people_involved / conflict_point /
      fact_structure / candidate_problem_dimensions / source_url
溯源：source_direction（赛道池=被哪条母题召回；公共池="broad"）
```

`hotspot_id` 命名：`hs-YYYYMMDD-NNN`，**两池合并后**当天内唯一。JSON 一律 Python `json.dump(..., ensure_ascii=False, indent=2)` 写入，禁止用编辑器直改大段中文 JSON。

**铁律：缺料不捏造**——富化字段读不出来就丢弃该条。

**回报**：公共池入池条数 + 各赛道池条数（按母题细分）+ 丢弃几条（缺料）。

---

## 入口② 给某个账号跑今日推荐

输入 = 公共池 + 本账号赛道池自动合并（`make-prompt.py` 内置，无需手工拼）。严格走现有脚本，不绕过、不手搓 today 文件：

```bash
# 1. 生成筛选提示词
python3 scripts/make-prompt.py <account_id> --date <D> --step match

# 2. agent 逐个读 data/runs/<D>/<account_id>/prompts/match-*.txt，当场作答，
#    回贴按同名写 data/runs/<D>/<account_id>/_inbox/match-<hotspot_id>.json

# 3. 只对 strong_pick / maybe 生成内容提示词并作答（skip 一律不生成）
python3 scripts/make-prompt.py <account_id> --date <D> --step generate
#    回贴写 _inbox/generate-<hotspot_id>.json

# 4. 收口安装（唯一有资格写 data/today/ 的通道）
python3 scripts/ingest.py <account_id> data/runs/<D>/<account_id>/_inbox --date <D>
```

**作答规则**：
- `prompts/` 是提示词输入；`_inbox/` 是待安装的模型回贴；`raw/` 是 `ingest.py` 成功后的原始回贴归档，**不要把 raw 当成 ingest 输入目录**。
- 文件名里的 `<hotspot_id>` 必须与热点池一致，错一个字 ingest 拒收。
- match 回贴必含 `tier`（strong_pick / maybe / skip）与 `skip_reason`；牵强就 skip，**不为凑数硬生成**。
- generate 回贴按提示词内嵌的 AdaptationOutput 合约：non-skip ≥3 条 `bridge_paths`、自然逻辑链 5 步齐全、成品不出现内部术语 / 赛道禁词 / 账号禁词。
- ingest 拒收某条时：读拒收原因 → 只重答那一条 → 重跑 ingest。不许改 ingest.py、不许直接改 `data/today/`。
- 若看到 `SameFileError`，通常是把 `raw/` 当成了 `ingest.py` 输入目录；把回贴放到 `_inbox/` 后重跑上面的 ingest 命令。

**产出**：`data/today/<account_id>/YYYY-MM-DD.json` + `latest.json`（网站今日页只读这里）。

**结尾人话汇总**：渲染 `prompts/分析提示词/每日总结.md`（填入 latest.json），按其可编辑区要求输出固定三段：

```text
✅ 今天发什么：strong_pick 条目 + 一句话钩子
🤔 为什么能发：每条的桥梁逻辑一句话（人话，不出现内部锚术语）
🚫 哪些别蹭：skip 条目 + skip_reason
```

如有 maybe，单列「可发但需老板拍板」。

---

## 入口③ 给全部账号跑今日推荐

遍历 `data/accounts/*.json` 中 `status == "active"` 的账号，逐个执行入口②。
最后输出一张总表：`账号 × 发什么 / 缓一缓 / 别蹭`。某账号失败不阻塞其他账号，最后统一报失败原因。

---

## 入口④ 新增账号 / 赛道（B档定版：先判断走哪条道）

> **对象模型**：Track（赛道）= 方法论对象，唯一事实源在 `config/tracks/<id>.json`
> （internal_lens / external_vocab / forbidden_terms / example_bridges / search_brief / search_directions / status / version）。
> Account（账号）= 渠道对象，只放业务事实（产品价值/证据/焦虑/禁话题/口吻/extra_*）。
> **账号永远不保存方法论副本**（`memory.bridge_directions` 已废弃）。

先问一句：**这个账号的赛道存在吗？**（查 `config/tracks/`）

### A. 赛道已存在且已定稿 → 账号快速通道（几分钟）

问 4 个账号级问题：① 产品最大的好？② 能取信的证据？③ 发什么平台、什么人设？④ 什么绝对不能碰？
→ 写 `data/accounts/acct-<赛道>-<平台>-<人设>.json`（track_id 指向现有赛道，memory 只填业务事实）→ 直接跑入口② 出首日样本。

### B. 赛道不存在 → 赛道车间（一次性，需博士定稿）

**第 1 步 · 问赛道级业务种子**：卖什么给谁？客户最焦虑什么？行业里什么是真问题什么是营销话术？（加上账号级 4 问一起问完，别挤牙膏。）

**第 2 步 · 两个固定模板连跑**（渲染稿和回答存 `data/runs/<D>/_onboarding/<track_id>/`）：

1. 渲染 `prompts/新增账号与赛道接入/新赛道桥梁母题.md` → 起草桥梁母题（internal_lens / external_vocab / forbidden_terms / example_bridges）。
2. 渲染 `prompts/新增账号与赛道接入/新赛道热点搜索方向.md` → 起草 3–6 条深层搜索母题（机理层、可成桥、可翻译成人话三关已固化在模板可编辑区）。

两步产出**全部写进 `config/tracks/<track_id>.json`**（bridge 区 + `search_brief` + `search_directions`），`status: "draft"`。

**第 3 步 · 交博士定稿**：明示「赛道已起草，status=draft，待博士定稿」。**draft 赛道：不进入口①b 定向搜索，`make-prompt.py` 会直接拒绝跑批**（硬闸门，不是约定）。博士确认后把 `status` 改 `"approved"`（教育参照赛道用 `"reference"`，视同定稿）。

**第 4 步 · 首日样本**：定稿后跑入口①b + 入口②，把首日「发什么 / 为什么 / 别蹭」交 owner 打分反馈。

### 修改赛道提示词的唯一入口

话术：「给 <赛道> 重写搜索方向」→ agent 重跑第 2 步模板 → 改 `config/tracks/<id>.json`（status 回 draft）→ 博士定稿 → `sync-to-db.py` 上线。改一处全系统生效，没有副本要追。

---

## 红线（违反即做错）

- `data/today/` 只能由 `ingest.py` 写入；agent 绝不手搓或直改。
- 不改 `prompts/*.md` 正文、不改 schema、不改 `scripts/`、不碰旧小朱看板与现网发布链。
- 成品出现内部术语（far transfer / 远迁移 / OOD 等）、赛道禁词、账号禁词 → 该条降级 skip。
- 牵强即 skip，绝不硬生成；skip 必须给人话 `skip_reason`。
- 两池边界：赛道母题（或外部定向报告）召回的料只进 `data/hotspots/tracks/<track_id>/`，绝不进公共池；公共池模板里不得出现任何赛道字眼。
- 热点字段本身保持中立：两池里都不写「推荐给谁/怎么用」的判断，归属只由存放位置和 `scope` 表达。
- 缺料不捏造：富化字段读不出来就丢弃该条热点。
- 不使用「流1-4」来源心智词组织任何对话与产物。
- 方法论唯一事实源是 `config/tracks/<id>.json`：搜索方向/内部锚只在这里改，绝不写进账号 memory；`status=draft` 的赛道不搜索、不跑批。

## 自检

```bash
python3 scripts/make-prompt.py --selftest
python3 scripts/ingest.py --selftest
```

跑批遇到与本文件冲突的现实（脚本参数变了、目录变了），以脚本 `--help` 与 `docs/RUNBOOK.md` 为准，并提醒用户更新本文件。
