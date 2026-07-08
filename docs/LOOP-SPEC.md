# Loop Engineering MVP 规格

本规格把当前项目收敛为一个本地文件驱动的每日内容生产闭环。当前 MVP 是 **single-admin internal MVP**：不包含登录、注册、RBAC、正式权限系统、多租户隔离或账号审批；所有内容生产由本地维护者/agent 跑批完成。`data/` 和 `config/` 是事实源；`ingest.py` 是正式写入 `data/today/<account_id>/latest.json` 的闸门；Turso 只作为线上只读镜像和 `feedback_inbox`。

账号不再有启用/停用状态开关；只要账号 JSON 存在且配置完整，就可以本地跑批。`track.status` 仍用于赛道风险提示，不是账号权限审批。非正式赛道产物会保留 `needs_human_review=true`、`formal_approval=false`、`mvp_internal_only=true` 这类工程标记，意思是“内部工程产物，不代表对外上线或生产同步”。BUILD-SPEC 里的 `T-M0.2/T-M1.2` 是历史 human-gate 工单，agent 不能代签；它们不是同事新增账号的审批流程。

## Loop 0: Track / Account Admission

- Goal 目标：确认哪些赛道和账号具备本地跑批所需文件和字段。
- Inputs 输入文件/数据：`config/tracks/*.json`、`data/accounts/*.json`、`config/platforms/*.json`、`config/positionings/*.json`。
- Executor 执行脚本/人工/agent：本地维护者或 agent 新增/修改 JSON。
- Checker 检查器：跑前用 `python3 scripts/status.py --date <YYYY-MM-DD> --preflight <account_id>`；跑后全量验收用 `python3 scripts/status.py --date <YYYY-MM-DD>`；另可用 `python3 scripts/make-prompt.py <account_id> --date <YYYY-MM-DD> --step match --no-print`、`node scripts/validate-configs.mjs`。
- Outputs 输出：可跑批的 track/account 配置。当前 `make-prompt.py` 不再读取账号状态；赛道非 `approved/reference` 时不阻断本地工程 run，但会打印 warning，并在 manifest / today output / run note 中标记为内部工程产物。
- Records 记录位置：`config/tracks/`、`data/accounts/`、`data/runs/<date>/<account_id>/manifest.json`。
- Feedback 失败如何返回：赛道 `draft/paused` 时可用于本地 internal MVP，输出会标记为内部工程产物。账号缺文件或缺必要字段时回到本地账号文件维护；缺配置字段时回到对应 `config/` 或 `data/accounts/`。
- Stop Conditions 停止条件：没有账号文件，账号引用的 track/platform/positioning 不存在，缺热点池，缺 daily flow 必要字段，或回贴无法通过 ingest 硬门。
- MVP Scope 当前 MVP：支持 single-admin 文件方式准入；`/onboarding` 只生成本地 JSON 草稿，不直接写库、不在线创建赛道/账号；不做正式权限系统，不做线上直接编辑账号记忆。`app/api/onboarding` 已返回 410。

## Loop 1: Hotspot Intake

- Goal 目标：准备当天公共热点池和赛道热点池，保持热点中立。
- Inputs 输入文件/数据：`data/hotspots/<date>.json`、`data/hotspots/tracks/<track_id>/<date>.json`，格式参考 `config/today-hotspots.demo.json`。
- Executor 执行脚本/人工/agent：人工或 agent 写热点池；`prompts/公共热点/来源注册/*.md`、默认公共热点正文 `prompts/公共热点/平台原生全网热点.md` 和赛道搜索提示词直接要求外部 LLM 输出可入池 JSON。
- Checker 检查器：跑前用 `python3 scripts/status.py --date <YYYY-MM-DD> --preflight <account_id>` 检查公共池和赛道池；full status 只在跑中/跑后列缺失项；另可用 `python3 scripts/make-prompt.py <account_id> --date <YYYY-MM-DD> --step match --no-print`。
- Outputs 输出：当天公共池和每个可运行赛道的赛道池 JSON。
- Records 记录位置：`data/hotspots/`、`data/hotspots/tracks/`、可选 `data/runs/<date>/_hotspot-pool/`。
- Feedback 失败如何返回：缺公共池或赛道池时回到热点采集；热点 JSON 损坏或缺 `hotspot_id` 时修正热点池；缺料不补写臆测字段。
- Stop Conditions 停止条件：公共池和赛道池都不存在，或热点文件不是 JSON 数组，或热点缺 `hotspot_id`。
- MVP Scope 当前 MVP：支持文件入池，不做自动爬热点，不让 LLM/API 直接写 `today/latest`。

## Loop 2: Match

- Goal 目标：判断每条热点对账号是 `strong_pick`、`maybe` 还是 `skip`。
- Inputs 输入文件/数据：Loop 0 的账号/赛道配置、Loop 1 的热点池、`prompts/分析提示词/热点匹配判断.md`。
- Executor 执行脚本/人工/agent：`python3 scripts/make-prompt.py <account_id> --date <date> --step match` 生成提示词；人工/agent/外部 LLM 把回答写进 `_inbox/match-<hotspot_id>.json`。
- Checker 检查器：`python3 scripts/ingest.py <account_id> data/runs/<date>/<account_id>/_inbox --date <date>` 会校验 match `tier`、`skip_reason`、非 skip 的 `why_relevant`。
- Outputs 输出：`data/runs/<date>/<account_id>/_inbox/match-*.json`，ingest 成功后归档到 `raw/`。
- Records 记录位置：`data/runs/<date>/<account_id>/prompts/`、`_inbox/`、`raw/`、`manifest.json`。
- Feedback 失败如何返回：match 缺字段、文件名和 `hotspot_id` 不一致、牵强未 skip 时，只重答该热点的 match。
- Stop Conditions 停止条件：赛道/账号不准入，热点池缺失，match 回贴无法抽出 JSON，或 `tier` 非法。
- MVP Scope 当前 MVP：明确区分 match 与 generate；不在线自动判断；skip 一律不进入 generate。

## Loop 3: Generate

- Goal 目标：只对 match 允许生成的热点产出内容草稿。
- Inputs 输入文件/数据：`_inbox/match-*.json`、`prompts/分析提示词/内容生成.md`、账号/赛道/平台/人设配置、热点池。
- Executor 执行脚本/人工/agent：`python3 scripts/make-prompt.py <account_id> --date <date> --step generate` 生成提示词；人工/agent/外部 LLM 把回答写进 `_inbox/generate-<hotspot_id>.json`。
- Checker 检查器：`ingest.py` 校验 AdaptationOutput 形状、non-skip 至少 3 条 `bridge_paths`、每条 5 步链、成品禁词、账号/赛道/平台/人设 id 一致。
- Outputs 输出：待安装的 generate JSON；skip 热点无 generate 时可由 match 直接生成 skip 结果。
- Records 记录位置：`data/runs/<date>/<account_id>/prompts/`、`_inbox/`、`raw/`。
- Feedback 失败如何返回：缺桥梁、缺 content、外显命中禁词、生成档位高于 match 时，重答该热点 generate；ingest 会把高档位封顶，禁词命中降级 skip。
- Stop Conditions 停止条件：match=skip、generate JSON 坏、缺 3 条桥梁、5 步链不完整、`external_terms_check` 非 true。
- MVP Scope 当前 MVP：不做在线实时生成；`scripts/answer.py` 只能作为离线答题辅助，正式安装仍走 `ingest.py`。

## Loop 4: Ingest / Publish

- Goal 目标：把通过硬门的结果安装成网站可读的今日推荐；`sync-to-db.py --dry-run` 用于验收将同步的线上只读镜像，正式同步是需授权的可选生产步骤。
- Inputs 输入文件/数据：`data/runs/<date>/<account_id>/_inbox/*.json`、可选反馈 JSON、`data/hotspots/`、`data/accounts/`、`config/`。
- Executor 执行脚本/人工/agent：`python3 scripts/ingest.py <account_id> data/runs/<date>/<account_id>/_inbox --date <date>`；验收同步计划用 `python3 scripts/sync-to-db.py --dry-run`。正式 `python3 scripts/sync-to-db.py` 只有在确认 Turso 是安全 dev/test 或负责人明确授权后才执行。
- Checker 检查器：ingest 后用 `python3 scripts/status.py --date <date>` 做全量验收；发布前还要跑 `npm run typecheck`、`npm run build`、`python3 adaptation-core/verify.py`。
- Outputs 输出：`data/today/<account_id>/<date>.json`、`data/today/<account_id>/latest.json`、`data/runs/<date>/<account_id>/installed.json`；授权同步后才会更新 Turso `docs` 镜像。
- Records 记录位置：`data/today/`、`data/runs/`；授权同步后记录到 Turso `docs` 表。
- Feedback 失败如何返回：ingest 失败则不写半成品，回到 match/generate 对应坏文件；sync dry-run 发现异常回到本地 JSON 修复。
- Stop Conditions 停止条件：ingest 非 0、status 仍缺关键项、sync dry-run 无法读 JSON、无法确认 Turso 环境且没有负责人授权。
- MVP Scope 当前 MVP：网站只读展示；不让 API 绕过 ingest 写 `latest.json`；不用 `vercel deploy`。

## Loop 5: Feedback Return

- Goal 目标：收集 owner 对已安装内容的反馈，并在下一轮跑批前回拉本地。
- Inputs 输入文件/数据：网站反馈请求、Turso `feedback_inbox`、本地 `data/runs/<date>/<account_id>/feedback-inbox/`。
- Executor 执行脚本/人工/agent：`app/api/feedback` 收集反馈；`python3 scripts/pull-feedback.py` 拉回；下一次 `ingest.py --feedback <file>` 归档。
- Checker 检查器：`python3 scripts/pull-feedback.py --selftest`、`python3 scripts/ingest.py --selftest`。
- Outputs 输出：`data/runs/<date>/<account_id>/feedback-inbox/*.json`，以及 ingest 归档的 `feedback/` 文件。
- Records 记录位置：Turso `feedback_inbox`、本地 `data/runs/<date>/<account_id>/feedback-inbox/`、`data/runs/<date>/<account_id>/feedback/`。
- Feedback 失败如何返回：反馈 JSON 缺账号/日期时跳过不盖章；本地归档失败时先修复文件，再进入下一轮 prompt 上下文。
- Stop Conditions 停止条件：无 Turso 凭据且非 selftest、反馈 body 非 JSON、缺 `date/account_id`。
- MVP Scope 当前 MVP：支持反馈收集和回拉；不做自动调权、不做在线 regenerate。`app/api/regenerate` 固定返回不可在线重跑。

## 当前 Gap

- 对外发布状态：`razor-personalcare` 是男士个护/剃须刀样例赛道，`acct-razor-douyin-boss` 已能本地跑到 latest；当前不需要为同事内部使用做审批。赛道仍为 `paused` 是历史状态标签，产物会标记为内部工程产物，不能表述为已对外上线或已生产同步。
- 自动热点：当前只有文件入口和提示词，没有自动爬取流水线。
- Spark 线上写入：`app/api/spark` 在生产 Turso 模式不直接写只读文件系统；spark 入池走本地文件处理。
- 反馈回流调参：MVP 只收集/拉回/归档反馈，不自动改赛道权重或账号记忆。
