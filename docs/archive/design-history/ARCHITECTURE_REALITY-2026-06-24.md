# ARCHITECTURE_REALITY.md — 真实架构事实文档（Phase 0）

> 归档说明：这是 2026-06-24 的架构审查记录，部分细节已被后续 MVP freeze 和文档整理更新。当前代码模块地图以 `docs/CODE-MAP.md` 为准，工程交接以 `docs/MVP-ARCHITECTURE-HANDOFF.md` 为准。

> 本文件只描述「当前线上真实长什么样」，不是理想架构设计。
> 写于一次只读审查之后，目的是让后续维护者（人或 agent）不要改错文件。
> 本文件不改任何业务逻辑；如与其它文档冲突，**以代码事实为准**，并请同步更新本文件。

---

## 0. 北极星 · 目标架构（开工前先读这段）

> **代码越笨越好——只做「渲染 / 校验 / 路由 / 存储」四件笨事；所有智能在 prompt+config；
> Python 流水线是唯一权威，TypeScript 只读展示、零判断。**

四条硬边界（任何改动先对照）：

1. **智能 vs 代码**：判断/方法论只在 `prompts/`（含 `tracks/<id>/`）和 `config/`，代码不写业务判断。
2. **语言边界**：Python 拥有整条流水线（含**唯一**的 gate 和排序，即 `ingest.py`）；TS 只读 `data/today` 渲染。
   TS 里现存的判断代码（`skip-gate.ts` / `server-data.ts`）只服务 warm-start 预览，**不在线上 today 路径**。
3. **单一真相**：每个关注点一个 owner——

   | 关注点 | 唯一 owner |
   |---|---|
   | 热点料 | `data/hotspots/` |
   | 赛道结构化事实 | `config/tracks/<id>.json` |
   | 赛道散文方法论 | `prompts/tracks/<id>/` |
   | 禁词 / 内部术语 | **`config/global-gate.json`**（Python 直接读；TS 由 `test/global-gate-parity.test.mjs` 守住一致） |
   | 合约 | `schemas/*.json` |
   | gate / 排序 | `ingest.py` |

4. **合约即闸门**：`schemas/*.json` 是唯一合约；`ingest.py` 的硬门（≥3 桥 5 步 / 零禁词 / external_terms_check）不可绕过。

**该砍 / 降级**（消灭「冒充主干」的副本）：`engine-bridge.ts` 删；`skip-gate.ts`/`server-data.ts` 判断逻辑明确标「预览专用、与 Python 同源」；Codex 的 `decision_layer/analysis_layer/track_memory/...` 降为 `status.py` 检查清单（方法论事实源回 `analysis_doctrine` + `prompts/tracks/<id>/`）；`/api/regenerate` 明确停用。

**最大风险 = 虚假的单一入口**：改 TS gate 测试会绿、线上跑批不变。改「是否跳过/排序/禁词」务必确认动到了 `ingest.py` 或 `config/global-gate.json`。

**变更日志**：
- 2026-06-24 Phase 1：建 `config/global-gate.json` 作禁词/内部术语单一来源；`make-prompt.py`（ingest 复用）改为从它读取（带 fallback，行为零变化）；加 `test/global-gate-parity.test.mjs` 守 TS 三处副本漂移；顺手修好被 razor 暂停误挂的 `make-prompt --selftest`（改为动态挑已定稿账号）。全套验证绿。
  - **已知遗留**：`display-text.ts` 只改写 9 个内部术语中的 5 个（缺 `in-distribution`/`范式转移`/`相关度分`/`自然度分`）；它是次级化妆层、主闸门是 ingest，留作后续相位补全或同样由 global-gate 驱动。
- 2026-06-24 Phase 2：① 给 `engine-bridge.ts`（死代码）、`skip-gate.ts`/`server-data.ts`（预览专用）贴明确标签，消除「冒充主干」混淆；② 经决策，给线上 `ingest.py` 闸门补 forced-hints 检查（同源 `config/global-gate.json`，成品可见文本出现「硬蹭/强行」等→降级 skip），并加 Python 自测 + 漂移守卫。至此 Python/TS 闸门有意义差异已对齐（仅剩 platform-mismatch，线上单平台不会发生）。全套验证绿（npm test 24/24）。

---

## 1. 当前真实架构 · 一句话

**本项目当前是一个文件驱动的多赛道热点适配工作台。**

线上今日推荐**不是**实时 LLM 生成，而是：`make-prompt.py` 拼提示词 → 人/外部 LLM 输出 match/generate JSON → `ingest.py` 校验并安装到 `data/today/<account>/latest.json` → 前端 `/api/today` 只读这份结果展示。

真正做「适配判断」的是 **prompts + 人/LLM**，不是任何 TypeScript engine。代码侧只负责**拼提示词、机械校验、硬门收口、读文件展示**。

---

## 2. 真实主流程

```text
data/hotspots/<date>.json                       （公共池, scope: "broad"）
+ data/hotspots/tracks/<track>/<date>.json      （赛道池, scope: "track:<id>"）
        │  两池由 make-prompt.load_hotspots 合并，公共池优先去重
        ▼
scripts/make-prompt.py <account> --date <D> --step match
        │  读 data/accounts/<id>.json + config/tracks|platforms|positionings
        │  buildEffectiveTrack（账号记忆叠加赛道方法论）
        │  draft 赛道在此被 ensure_track_approved 硬闸门挡下（不准跑批）
        ▼
data/runs/<D>/<account>/prompts/match-*.txt
        ▼
[人/外部 LLM 逐条作答]  →  data/runs/<D>/<account>/_inbox/match-<hotspot_id>.json
        │  必含 tier: strong_pick | maybe | skip，含 skip_reason
        ▼
scripts/make-prompt.py <account> --date <D> --step generate   （只对非 skip 的热点）
        ▼
data/runs/<D>/<account>/prompts/generate-*.txt
        ▼
[人/外部 LLM 作答]  →  data/runs/<D>/<account>/_inbox/generate-<hotspot_id>.json
        │  AdaptationOutput 合约：≥3 桥、每桥 5 步、content 三件套、external_terms_check=true
        ▼
scripts/ingest.py <account> data/runs/<D>/<account>/_inbox --date <D>   ★唯一有资格写 data/today
        │  机械校验（id 一致 / 5 步齐 / ≥3 桥 / external_terms_check）
        │  cap_recommendation（match=skip 封顶 generate；档位只降不升）
        │  gate_visible（内部术语 + 赛道/账号禁词命中 → 降级 skip）
        │  to_board（tier 优先 → 0.5*relevance + 0.5*naturalness；heat 不进排序）
        ▼
data/today/<account>/<date>.json   +   data/today/<account>/latest.json
        │  留痕：data/runs/<D>/<account>/{raw/, installed.json, manifest.json}
        ▼
app/api/today/route.ts   （loadTodayFile：读 latest，坏了回退最近日期归档；不调 LLM）
        ▼
app/today/page.tsx  →  redirect  →  app/account/[account_id]/page.tsx?tab=today
        │  displayText() 化妆后渲染（黑名单式术语改写）
        ▼
用户（老板/运营）看到：✅ 发什么 / 🤔 为什么能发 / 🚫 别蹭
```

**与代码一致的细节补充：**
- `_inbox/` 是待安装回贴目录；`raw/` 是 ingest 成功后的归档目录。**不要把 `raw/` 当 ingest 输入**（会 SameFileError）。
- 前端取数实际走 `lib/today-cache.fetchToday` → `POST /api/today`，再用 localStorage 按「账号×天」缓存；「刷新」才重取。**缓存的是文件读取结果，不是 LLM 生成结果。**
- `/api/today` 找不到 latest 时回退最近日期归档，并在 notice 里说明「展示的是 X 日数据」。

---

## 3. 权威入口表（线上真实）

| 角色 | 权威文件 / 脚本 | 职责 |
|---|---|---|
| 热点输入（公共池） | `data/hotspots/<date>.json` | 全账号共享、scope=broad 的中立热点 |
| 热点输入（赛道池） | `data/hotspots/tracks/<track>/<date>.json` | 仅该赛道账号可见、scope=track:<id> |
| 账号配置 | `data/accounts/<account_id>.json` | 业务事实 + memory（**不存方法论副本**） |
| 赛道配置 | `config/tracks/<track_id>.json` | 方法论唯一事实源：internal_lens / external_vocab / forbidden_terms / search_directions / example_bridges / status |
| 平台配置 | `config/platforms/<platform_id>.json` | 表达形态 / 标题逻辑 / 长度 / 禁忌 |
| 定位配置 | `config/positionings/<positioning_id>.json` | 人设口吻 voice |
| prompt 生成 | `scripts/make-prompt.py` | 渲染 `prompts/*.md`，落 `data/runs/.../prompts/*.txt` |
| LLM 输出安装 | `scripts/ingest.py` | **唯一**有资格写 `data/today/`；校验 + 封顶 + 降级 + 排序 + 安装 |
| skip / gate（线上） | `scripts/ingest.py` 的 `gate_visible()` + `validate_adaptation_output()` + `cap_recommendation()` | 线上真正决定 skip / 降级的地方 |
| 排序（线上） | `scripts/ingest.py` 的 `to_board()` | tier 优先 → 0.5*relevance+0.5*naturalness，**heat 不参与** |
| 今日推荐成品 | `data/today/<account_id>/latest.json`（+ `<date>.json`） | 前端唯一读取的结果文件 |
| 前端读取入口 | `app/api/today/route.ts` → `lib/file-data.loadTodayFile` → `lib/data-source.getDoc("today", ...)` | 读文件（Turso 或本地 FS 双源），不调 LLM |
| 前端页面 | `app/account/[account_id]/page.tsx`（`app/today/` 仅 redirect） | 渲染 picks / skipped / meta |
| 内部术语清单（被多处引用） | 常量 `INTERNAL_OR_SCORE`，**当前硬编码在 `scripts/make-prompt.py`**（ingest.py 从它 import） | 内部术语黑名单 Python 侧事实源 |
| 反馈记录 | 前端 `lib/today-cache`（localStorage）+ `app/api/feedback/route.ts` + `scripts/pull-feedback.py` | 落盘归档；**当前只归档不回流** |
| 配置校验 | `scripts/validate-configs.mjs`（`npm run validate:configs`） | 字段必填 + 账号外键引用完整性（手写，非 JSON Schema） |
| 跨仓依赖（运行时） | `../skills/adaptation-engine/prompt_loader.py` | make-prompt / ingest 都 import 它（占位符白名单 + JSON 抽取）；**在父仓，不在本仓 .git 内** |

---

## 4. 容易误判的「假主干」

> 这些文件**读起来像核心**，但**不在真实 `/today` 主流程上**。改它们多半不会改变线上跑批行为。

| 文件 | 在 /today 主流程? | 实际服务什么 | 性质 | 维护态度 |
|---|---|---|---|---|
| `lib/skip-gate.ts`（`evaluateSkipGate`） | **否** | 只被 `lib/server-data.ts`（warm-start 预览）和 `test/*` 引用 | warm-start / preview gate（比线上 ingest gate 更全：含 forced hints、platform_mismatch） | 谨慎。改它**不影响线上**；线上 gate 是 `ingest.py:gate_visible`。两者需保持 parity（见 Phase 2） |
| `lib/server-data.ts`（`toBoard` / `gateVisible` / `buildMeta`） | **否** | warm-start 暖启动样板、onboarding 预览装配 | preview 装配中枢（与 ingest.py 的 to_board/build_meta 是**平行重复实现**） | 谨慎。线上 board 由 `ingest.py:to_board` 装配，不走这里 |
| `lib/engine-bridge.ts` | **否** | **无人 import** | **死代码**（在线引擎桥的残留，324 行） | 不要在它上面继续开发；Phase 3 标注或删除 |
| `app/api/regenerate/route.ts` | 名义在 | 无条件返回 `ok:false` | **停用桩**（文件模式不支持在线重生成） | 不要试图"修好"它去做在线生成；它是有意关闭 |
| `lib/today-cache.ts` | 是（取数+缓存） | 真在主流程，但**注释自称「决策 B 按需生成+缓存」具误导性** | 实际只做 localStorage 缓存 + 读文件，**无按需 LLM 生成** | 可用，但别被注释骗去找"生成"逻辑 |
| `lib/config-contracts.ts`（normalize*） | 否（仅测试/装配辅助） | 配置归一化，被 `p0-maintainable.test` 引用 | 辅助校验层（与 `validate-configs.mjs`、`adaptation-core/schemas` 三套并存） | 谨慎；非线上判定路径 |
| `lib/dashboard-data.ts` / `lib/warm-start-seed.ts` / `lib/track-calibration.ts` | 否 | onboarding / 工作台 / 暖启动装配 | 辅助装配 | 非今日推荐判定路径 |

**一句话记忆**：线上今日推荐 = `ingest.py` 装配的 `data/today` + `/api/today` 读文件。**所有 `lib/*.ts` 的 gate/board/meta 逻辑都只服务预览与装配，不决定线上跑批结果。**

---

## 5. 改动定位指南（要改什么 → 看哪里）

| 想改的东西 | 真实应改文件 | 备注 |
|---|---|---|
| 是否推荐 / 是否跳过（判断口径） | `prompts/hotspot-match.md`（判断在这里 + 人/LLM） | 代码不做这个判断；prompts 是博士把关区 |
| 是否推荐 / 是否跳过（机械收口） | `scripts/ingest.py`：`cap_recommendation` / `gate_visible` | 代码只会把档位往 skip 收紧，不会提升 |
| 非 skip 必须满足的硬条件 | `scripts/ingest.py`：`validate_adaptation_output`（≥3 桥 / 5 步 / content 三件套 / external_terms_check） | 这是线上硬门；改它=改契约，需谨慎 |
| 内部术语 / 禁词 | 内部术语：`scripts/make-prompt.py` 的 `INTERNAL_OR_SCORE`（Python 侧源）；赛道禁词：`config/tracks/<id>.json` 的 `bridge.forbidden_terms`；账号禁词：`data/accounts/<id>.json` 的 `memory.extra_forbidden_terms` | ⚠️ 同一份内部术语清单当前还硬编码在 `lib/skip-gate.ts` / `lib/adaptation-types.ts` / `lib/display-text.ts`，改一处要同步四处（Phase 1 要收口） |
| 排序 | 线上：`scripts/ingest.py:to_board`；预览：`lib/server-data.ts:toBoard`+`rankScore` | 两套都是 tier 优先 → 0.5rel+0.5nat；改要同时改两处 |
| 老板看到的「推荐理由」 | 线上：`scripts/ingest.py:build_meta`；预览：`lib/server-data.ts:buildMeta` | 模板拼接，无判断；同样双实现 |
| 前端展示 | `app/account/[account_id]/page.tsx` 等页面 + `lib/display-text.ts`（术语化妆） | display-text 是黑名单替换；勿在此堆赛道专属词 |
| 新增赛道 | 加 `config/tracks/<track_id>.json`（status=draft，博士定稿后改 approved/reference） | draft 被 make-prompt 硬闸门挡住不跑批；不改引擎 |
| 新增账号 | 加 `data/accounts/<account_id>.json`（track_id 指向现有赛道，memory 只填业务事实） | 可选先放 `config/account-profiles/` 作种子 |
| 新增平台 | 加 `config/platforms/<platform_id>.json` | 字段见 `validate-configs.validatePlatform` |
| 反馈回流 | 当前：`app/api/feedback` + `scripts/pull-feedback.py`（只归档） | 真正回流逻辑尚未接通；ingest 的 `--feedback` 只进 manifest 标记 |

---

## 6. 当前最大风险

**「虚假的单一入口」。**

`lib/skip-gate.ts` 和 `lib/server-data.ts` 读起来像核心适配与 gate 入口，但真实线上今日推荐主要由 `scripts/ingest.py` 安装后的 `data/today/<account>/latest.json` 驱动。`/api/today` 只读这份文件，**不经过任何 TS gate / TS 装配**。

后果：**后续如果只改 TS gate（skip-gate.ts），单元测试可能变绿，但线上跑批行为完全不变。** 反之，线上真正生效的 `ingest.py:gate_visible` 当前比 TS gate 更薄（缺 forced-connection / platform-mismatch 检查），强 gate 守在最不需要的预览处，弱 gate 守在最需要的实时处。

凡是改「是否跳过 / 排序 / 禁词」，**先确认是否动到了 `ingest.py`**；只动 `lib/*.ts` 等于没动线上。

---

## 7. 当前阶段禁止事项

- 不要重构目录。
- 不要把 Python 流程迁移成 TypeScript。
- 不要改 `prompts/*.md` 正文（判断口径，博士把关）。
- 不要改 `scripts/ingest.py` 的硬门契约（5 步 / ≥3 桥 / content 三件套 / external_terms_check / 封顶规则）。
- 不要做在线 LLM 生成（`/api/regenerate` 是有意关闭的）。
- 不要做数据库迁移、多租户、权限、团队协作、自动发布。
- 不要继续给 `lib/display-text.ts` 硬编码赛道专属词（赛道黑话应迁进赛道配置，属 Phase 4）。
- 不要把 `lib/skip-gate.ts` 误当成线上唯一 gate。

---

## 8. 下一阶段建议（只建议，不在本次执行）

- **Phase 1**：抽 `config/global-gate.json`，让内部术语、禁词、forced hints 有**单一事实源**；Python（make-prompt/ingest）与 TS（skip-gate/adaptation-types/display-text）都从它读取。Additive，不改判定逻辑。
- **Phase 2**：给 Python `ingest.py` gate 与 TS `skip-gate.ts` gate 加 **parity test**——同一条 output 喂两侧得到相同 skip 结论；优先补齐 Python 侧缺的检查项。
- **Phase 3**：清理或明确标注已确认的 dead code / stopped path（`engine-bridge.ts`、`/api/regenerate`、`today-cache.ts` 误导性注释），并把 `verify.py` / `validate:configs` 纳入统一 `npm run check`。
- **Phase 4**：再考虑是否收口前端展示层（display-text 赛道词迁进配置）与 feedback 回流。

> 以上为建议，本次（Phase 0）不执行，仅落此文档。
