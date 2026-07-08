# MVP 架构交接文档

本文是工程详细源文档。整个 workspace 的交接包目录在根目录 `交接文档/`；交接阅读优先看那个文件夹。本文保留为更细的工程源资料。

普通同事不建议直接读本文，应该读一页版 `docs/同事使用指南.md`。同事使用指南只回答：打开哪个地址、怎么看今日推荐、必发 / 拍板 / 别蹭是什么意思、怎么反馈、今天没内容怎么办、新增账号找谁。

运营如果没有 agent，只用外部 LLM 逐步跑业务闭环，读 `docs/OPERATIONS-LLM-RUNBOOK.md`。那份文档从新增账号、公共热点、赛道热点、match、generate 到 ingest 都给了提示词路径和保存位置。

以下命令默认在 `yowow-adaptation/` 目录下执行。

---

## Current Final Status

可以宣布：

- MVP 工程闭环本地可跑通。

不能宣布：

- 正式业务 MVP 完成。
- razor 赛道正式 approved。
- 已上线。
- 博士已签 T-M0.2 / T-M1.2。
- 正式 Turso sync 已完成。

已验证：

- education account 可跑到 latest。
- razor account 可本地跑到 latest，但 needs_human_review。
- `npm run test` 通过。
- `npm run typecheck` 通过。
- `npm run test:e2e` 通过。
- `python3 adaptation-core/verify.py` 通过。

仍需负责人/博士决策：

- razor 是否进入正式 approval。
- T-M0.2 / T-M1.2 是否签字。
- 是否授权正式 `sync-to-db.py`。
- 是否配置生产 Vercel / Turso。

---

## Project Memory Snapshot（2026-06-30）

这一节是给下一位接手人的当前记忆，只记录已经发生且会影响继续操作的事实。

当前可用入口：

- 本地前端：`http://127.0.0.1:3000`
- 单人跑批台：`http://127.0.0.1:3000/ops`
- 教育账号结果页：`http://127.0.0.1:3000/account/acct-xiaozhu-edu-xhs?date=2026-06-30`

当前数据状态：

| 项 | 当前事实 |
|---|---|
| 教育账号 | `acct-xiaozhu-edu-xhs`，字段完整，`education-yowow status=approved` |
| 教育 latest | `data/today/acct-xiaozhu-edu-xhs/latest.json` 指向 `2026-06-30`，当前 `board.picks=22`，`board.skipped=14`，`formal_approval=true` |
| razor 账号 | `acct-razor-douyin-boss`，字段完整 |
| razor 赛道 | `razor-personalcare status=paused`，保持 paused；这不是同事内部试用审批，只是历史状态标签 |
| razor latest | `data/today/acct-razor-douyin-boss/latest.json` 指向 `2026-06-29`，当前 `board.picks=2`，`board.skipped=2`，`needs_human_review=true`，`formal_approval=false` |
| razor 2026-06-30 | 当前缺 `data/hotspots/tracks/razor-personalcare/<date>.json` 对应日期文件，不能直接跑当日 razor fresh-run |
| 正式同步 | 未执行正式 `python3 scripts/sync-to-db.py` |
| human gate | 未签 `T-M0.2 / T-M1.2` |

本轮已知坑和处理方式：

- `/ops` 是本地单人运营台，不是线上跑批系统。`app/api/ops/*` 在生产且启用 Turso 时会拒绝本地写入。
- 页面保存 GPT 回贴前必须确认当前选择的 `account_id` 和 `date`。如果页面选错账号，不能把教育回贴保存到 razor 的 `_inbox`。
- 当前 `lib/ops-workbench.ts` 已加保护：保存 match/generate 回贴时，会检查当前账号是否已经生成对应 `prompts/<stage>-<hotspot_id>.txt`；缺提示词就拒绝保存，避免错账号写入。
- 2026-06-30 曾发生一次教育 generate 回贴误粘到 razor 账号的操作。已把 24 个 generate 文件移回 `data/runs/2026-06-30/acct-xiaozhu-edu-xhs/_inbox/`，原误存文件备份在 `data/runs/2026-06-30/acct-razor-douyin-boss/_misfiled-education-generate-backup-20260630/`。
- 如果页面报“这批 GPT 回贴和当前选择的账号不匹配”，先切回生成这批提示词时的账号，再保存或安装；不要手改 `hotspot_id` 去凑。
- `/ops` 后续最值得补的小 UX 是把选中的 `account_id/date` 持久化到 URL 或 localStorage，避免刷新后默认落到第一个账号。

提示词记忆：

- `prompts/分析提示词/热点匹配判断.md` 是“热点可发判断 Skill”，不是普通聊天提示词。输出应为 JSON 对象或 JSON 数组，不要 Markdown、解释和多余文字。
- `prompts/分析提示词/内容生成.md` 是“分析 + 内容生成 Skill”，下一步会直接安装到今日页面；输出字段以生成的 `generate-*.txt` 和 `scripts/ingest.py` 为准。
- 赛道博士分析层在 `prompts/分析提示词/<track_id>/赛道分析.md`。`scripts/make-prompt.py` 会通过 `{track_analysis}` 注入到 generate prompt；例如教育赛道会接入张雪峰式/博士式分析骨架。
- 公共热点提示词已经要求输出中立热点池 JSON，不需要再单独做“把原始热点中立化”的二次步骤。
- 公共热点提示词注册接口已落地：新增公共热点来源放 `prompts/公共热点/来源注册/<中文名>.md`，`/ops` 会自动扫描展示复制卡片；说明见 `prompts/公共热点/来源注册/说明.md`。
- 用户提出一个新的热点入口需求：普通热点新闻和 AI 圈人物言论抓取不足，需要“人物言论雷达”专门抓取 AI / 科技 / 教育 / 商业 / 投资 / 政策等关键人物的公开言论。当前已保留 `prompts/公共热点/来源注册/人物言论雷达.md` 草稿，但 `enabled:false`，不会出现在 `/ops`。
- 如果后续确认落地，先补正文并把 `prompts/公共热点/来源注册/人物言论雷达.md` 改为 `enabled:true`；它定位为公共热点入口，输出仍然保存到 `data/hotspots/<date>.json`。不需要为它单独改 `lib/ops-workbench.ts`。
- 人物言论雷达的输出边界：只输出热点池 JSON 数组；不写文章、不做账号推荐、不长篇引用；必须带 `speaker`、`quote_summary`、`quote_type`、`verification_status`、`risk_notes`、`source_url/source_notes`，不能编造言论或链接。

下一次接手优先级：

1. 如果只是日常出内容，先用 `/ops` 或 `docs/OPERATIONS-LLM-RUNBOOK.md` 跑教育账号；不要先改代码。
2. 如果要跑 razor 的某一天，需要先准备 `data/hotspots/tracks/razor-personalcare/<date>.json`，再 preflight。
3. 如果要提升热点质量，优先考虑是否启用 `prompts/公共热点/来源注册/人物言论雷达.md`；启用前不要假设它会出现在 `/ops`。
4. 如果要改善前端运营体验，优先做 `/ops` 的账号/日期持久化和更明确的账号选择提示。
5. 如果要上线或同步 Turso，必须先拿负责人明确授权，再执行正式 `sync-to-db.py`。

---

## 0. 接手环境与运行模式

### 0.1 首次启动清单

以下命令默认在 `yowow-adaptation/` 目录下执行。

```bash
node --version
npm ci
npm run typecheck
npm run test
python3 scripts/status.py --date 2026-06-30 --preflight acct-xiaozhu-edu-xhs
npm run dev
```

环境要点：

- Node 版本：`package.json` 写明 `node: 20.x`。
- Python：脚本当前用系统 `python3`，没有独立虚拟环境要求。
- 本地前端：`npm run dev` 后打开 `http://127.0.0.1:3000`。
- 本地跑批台：`http://127.0.0.1:3000/ops`。
- Playwright：只有需要跑浏览器 E2E 时使用 `npm run test:e2e`；如本机首次缺浏览器，按 Playwright 提示安装浏览器。
- `.env.example` 只包含 Turso 线上镜像变量；本地文件模式不需要 `.env.local`。
- 不读取、不输出、不修改任何 `.env.local`、token、password 或生产密钥。

### 0.2 运行模式矩阵

| 模式 | 数据读取 | 允许写入 | 禁止事项 | 适用场景 |
|---|---|---|---|---|
| 本地文件模式（默认） | `lib/data-source.ts` / `lib/file-data.ts` 读 `data/ + config/` | `/ops` 可写热点池和 `_inbox`；`ingest.py` 可写 `data/today`；账号 memory/delete API 可写本地文件 | 不能执行正式 `sync-to-db.py`，除非另有授权 | 日常开发、单人运营、交接验收 |
| 本地 + Turso env | `lib/data-source.ts` 会优先读 Turso docs | feedback 可进 Turso `feedback_inbox`；正式 sync 仍需授权 | 不确定 Turso 指向时不能正式同步 | 调试线上镜像读取或反馈 |
| Vercel / 生产 + Turso | 网站读 Turso docs 镜像 | `app/api/feedback` 可收反馈；`app/api/ops/*` 会拒绝本地写入；`spark` 不直接写只读文件系统 | 不能用 `/ops` 在线跑批，不能在线写 `data/today`，不能在线自助 onboarding 写库 | 只读展示和反馈收集 |

关键事实：

- `data/ + config/` 是本地事实源。
- Turso 是线上只读镜像和反馈收件箱，不是当前主数据库。
- `scripts/sync-to-db.py --dry-run` 是日常验收；正式 `scripts/sync-to-db.py` 是授权后的生产动作。

### 0.3 数据契约速查

| 数据 | 谁写 | 谁读 | 是否可手写 | 说明 |
|---|---|---|---|---|
| `data/accounts/<account_id>.json` | 管理员、`/onboarding` 复制后人工保存、账号 memory API 本地 patch | `make-prompt.py`、前端账号列表和账号页 | 可以人工维护，但要保持 JSON 合法 | 当前账号事实和账号记忆 |
| `config/tracks/<track_id>.json` | 管理员 / 工程师 | `make-prompt.py`、`status.py`、前端赛道页 | 可以人工维护 | 赛道判断标准、搜索方向、禁词、分析层字段 |
| `config/platforms/*.json` | 工程师 | `make-prompt.py`、前端展示 | 可以人工维护 | 平台规则 |
| `config/positionings/*.json` | 工程师 | `make-prompt.py`、前端展示 | 可以人工维护 | 人设口吻 |
| `data/hotspots/<date>.json` | `/ops` 或人工 | `status.py`、`make-prompt.py`、前端热点页 | 可以由 `/ops` 保存或人工维护 | 公共热点池 |
| `data/hotspots/tracks/<track_id>/<date>.json` | `/ops` 或人工 | `status.py`、`make-prompt.py`、前端热点页 | 可以由 `/ops` 保存或人工维护 | 赛道热点池 |
| `data/runs/<date>/<account_id>/prompts/*.txt` | `scripts/make-prompt.py` | 人工 / 外部 LLM / `/ops` | 不建议手写 | 本次跑批提示词快照 |
| `data/runs/<date>/<account_id>/_inbox/*.json` | 外部 LLM / agent / 人工 / `/ops` | `scripts/ingest.py` | 可以写，但必须按文件名和 schema | 回贴暂存区 |
| `data/runs/<date>/<account_id>/raw/` | `scripts/ingest.py` | 审计 / 回溯 | 不手写 | ingest 归档后的原始回贴 |
| `data/runs/<date>/<account_id>/installed.json` | `scripts/ingest.py` | 审计 / status | 不手写 | 本次安装摘要 |
| `data/runs/<date>/<account_id>/manifest.json` | `make-prompt.py` / `ingest.py` | status / 审计 | 不手写 | 跑批记录 |
| `data/today/<account_id>/<date>.json` | 只能 `scripts/ingest.py` | 前端 / sync-to-db | 不能手写 | 当日安装结果 |
| `data/today/<account_id>/latest.json` | 只能 `scripts/ingest.py` | 前端 latest 读取 | 不能手写 | 网站默认读取的最新结果 |

### 0.4 变更验证矩阵

| 改动类型 | 最低验证 | 建议加跑 |
|---|---|---|
| 只改文档 | 读一遍相关入口，确认没有和主文档冲突 | 无需跑测试 |
| 改 prompt | `python3 scripts/make-prompt.py --selftest`、生成一个目标账号 prompt 目测关键字段 | `npm run test` |
| 改 track/account/platform/positioning 配置 | `python3 scripts/status.py --date <date> --preflight <account_id>`、`node scripts/validate-configs.mjs` | `npm run test` |
| 改 `scripts/make-prompt.py` | `python3 scripts/make-prompt.py --selftest`、真实账号 match/generate 各跑一次 | `npm run test` |
| 改 `scripts/ingest.py` | `python3 scripts/ingest.py --selftest` | `npm run test`、抽一个真实 `_inbox` dry run 思路检查 |
| 改 `/ops` 或 `lib/ops-workbench.ts` | `node --test test/ops-workbench.test.mjs` | `npm run test:e2e` |
| 改前端页面 / 组件 | `npm run typecheck`、`npm run test` | `npm run test:e2e` |
| 改 Turso / sync 逻辑 | `python3 scripts/sync-to-db.py --dry-run` | 不得正式 sync，除非负责人授权 |
| 改全局红线 / 禁词 / gate | `npm run test`、`python3 ../adaptation-core/verify.py` | 真实账号 preflight + ingest 自测 |

### 0.5 事故恢复 SOP

错账号粘贴 GPT 回贴：

1. 停止继续 ingest，不要手改 `data/today/`。
2. 查错账号 `_inbox`：`data/runs/<date>/<wrong_account>/_inbox/`。
3. 对照正确账号的 `prompts/<stage>-<hotspot_id>.txt`，确认这些回贴属于哪个账号。
4. 把误存文件移到正确账号 `_inbox/`，同时在错账号目录留备份，如 `_misfiled-<account>-backup-<date>/`。
5. 对正确账号重跑 `python3 scripts/ingest.py <account_id> data/runs/<date>/<account_id>/_inbox --date <date>`。
6. 打开账号页确认 `latest.json` 日期和数量正确。

坏 JSON / ingest 拒收：

1. 不要绕过 ingest 写 today。
2. 看错误里的 `hotspot_id` 和字段名。
3. 只重答对应 `match-*.json` 或 `generate-*.json`。
4. 重跑 ingest。

热点池日期错：

1. 不要复制粘贴改 latest。
2. 把热点池文件移动到正确日期路径。
3. 重跑 `status.py --preflight` 和 `make-prompt.py`。

`latest.json` 疑似污染：

1. 找同目录日期文件：`data/today/<account_id>/<date>.json`。
2. 找对应 run 的 `installed.json`、`manifest.json`、`raw/`。
3. 如 latest 来自错误 run，重新用正确 `_inbox` 跑 ingest 覆盖 latest。
4. 如果已经正式 sync 到 Turso，先停止继续 sync，负责人确认后再用正确本地文件重新 sync。

误执行正式 `sync-to-db.py`：

1. 立刻保存终端输出和 dry-run / sync 时间。
2. 不再重复执行 sync。
3. 确认 Turso 指向 dev/test 还是生产。
4. 如果是生产，负责人决定是否用正确本地 `data/ + config/` 再次同步覆盖。

### 0.6 Owner / Decision Log

| 决策 | 当前状态 | 需要谁决定 | 产物 / 材料位置 |
|---|---|---|---|
| razor 是否正式 approval | 未 approved；`razor-personalcare status=paused` | 负责人 / 博士 | `data/today/acct-razor-douyin-boss/latest.json` 仅代表 internal MVP |
| T-M0.2 桥梁自然度 | 未签 | 博士 | `adaptation-core/BUILD-SPEC.md` 和历史 fixture/parity 材料 |
| T-M1.2 教育平价 | 未签 | 博士 | `adaptation-core/fixtures/parity/`（历史材料） |
| 正式 `sync-to-db.py` | 未授权执行 | 负责人 | 先跑 `python3 scripts/sync-to-db.py --dry-run` |
| 生产 Turso / Vercel | 未配置为完成状态 | 负责人 / 工程负责人 | `.env.example` 只列变量名，不含密钥 |
| 人物言论雷达是否落地 | 有草稿，未启用 | 负责人 / 运营 owner | `prompts/公共热点/来源注册/人物言论雷达.md` 当前 `enabled:false` |

---

## 1. 当前 MVP 到底是什么

当前系统是本地文件驱动的 single-admin internal MVP：

- 不做登录、注册、RBAC、付费、多租户权限隔离。
- 不做在线实时生成。
- 不让 LLM 或 API 直接写 `data/today/`。
- `data/ + config/` 是本地事实源。
- `scripts/ingest.py` 是唯一安装 `data/today/<account_id>/latest.json` 的正式入口。
- `sync-to-db.py --dry-run` 是日常验收步骤；正式同步是授权后的可选生产步骤。

整体闭环：

```text
/onboarding 问卷
  -> 页面代码: app/onboarding/page.tsx
  -> 问卷逻辑: lib/onboarding-questionnaire.mjs
  -> 生成账号 JSON 后由管理员手动保存到: data/accounts/<account_id>.json
  -> 生成赛道 JSON 草稿后由管理员手动保存到: config/tracks/<track_id>.json

热点池
  -> 公共热点: data/hotspots/<date>.json
  -> 赛道热点: data/hotspots/tracks/<track_id>/<date>.json

scripts/make-prompt.py
  -> 读取 account: data/accounts/<account_id>.json
  -> 读取 track: config/tracks/<track_id>.json
  -> 读取 platform: config/platforms/<platform_id>.json
  -> 读取 positioning: config/positionings/<positioning_id>.json
  -> 读取 hotspots: data/hotspots/<date>.json + data/hotspots/tracks/<track_id>/<date>.json
  -> 渲染 match 模板: prompts/分析提示词/热点匹配判断.md
  -> 渲染 generate 模板: prompts/分析提示词/内容生成.md
  -> 写入本次跑批提示词: data/runs/<date>/<account_id>/prompts/*.txt

外部 LLM / agent / 人工
  -> 回答 match-*.txt
  -> 回答 generate-*.txt
  -> 把 JSON 回贴放入: data/runs/<date>/<account_id>/_inbox/*.json

scripts/ingest.py
  -> 校验 match/generate JSON
  -> 校验 id 一致、禁词、内部术语、桥梁 5 步
  -> 写入当天结果: data/today/<account_id>/<date>.json
  -> 写入网站读取的 latest: data/today/<account_id>/latest.json

Next.js 网站
  -> 首页: app/page.tsx
  -> 账号页: app/account/[account_id]/page.tsx
  -> 数据读取: lib/data-source.ts / lib/dashboard-data.ts / lib/file-data.ts
  -> 今日 API: app/api/today/route.ts
  -> 只读: data/today/<account_id>/latest.json 或 Turso docs 镜像

scripts/sync-to-db.py --dry-run
  -> 只做同步预检
  -> 正式 sync 只有明确授权时才执行
```

---

## 2. 每个模块在哪里改

| 想改什么 | 改哪里 | 说明 |
|---|---|---|
| 本地单人跑批台页面 | `app/ops/page.tsx`、`components/adaptation/OpsWorkbench.tsx` | 给运营复制热点提示词、粘贴热点池、生成 match/generate prompt、粘回 GPT JSON、触发 ingest |
| 跑批台后端动作 | `app/api/ops/*`、`lib/ops-workbench.ts` | 只在本地 dev 可写；生产 + Turso 会拒绝；这里负责保存热点池、保存 `_inbox`、运行脚本 |
| 新增账号问卷问题 | `lib/onboarding-questionnaire.mjs` | `QUESTION_SECTIONS` 控制问题；`buildAccountJson` / `buildTrackDraftJson` 控制生成 JSON |
| 新增账号页面样式和布局 | `app/onboarding/page.tsx` | 只负责展示问卷和 JSON 预览，不直接写文件 |
| 账号事实 / 账号记忆 | `data/accounts/<account_id>.json` | 具体卖什么、卖给谁、客户焦虑、证据、口吻、账号禁词 |
| 赛道事实 / 赛道记忆 | `config/tracks/<track_id>.json` | 赛道名、产品价值、赛道焦虑、搜索方向、对外词、禁词、判断层、分析层 |
| 平台规则 | `config/platforms/<platform_id>.json` | 平台内容形态、标题逻辑、钩子、长度习惯 |
| 人设口吻 | `config/positionings/<positioning_id>.json` | 老板型、专家型、工厂源头型等 |
| 公共热点池 | `data/hotspots/<date>.json` | 全赛道共享热点 |
| 赛道热点池 | `data/hotspots/tracks/<track_id>/<date>.json` | 某赛道专属热点 |
| match 判断提示词 | `prompts/分析提示词/热点匹配判断.md` | 改“什么算接得住、什么该 skip” |
| generate 生成提示词 | `prompts/分析提示词/内容生成.md` | 改“怎么生成桥梁路径、标题、正文、风险提醒” |
| 公共热点抓取提示词 | `prompts/公共热点/平台原生全网热点.md` | 没有自动爬虫时，手工给外部 LLM 抓公共热点；提示词直接输出可入池 JSON |
| 赛道热点搜索提示词 | `prompts/赛道热点/通用赛道热点搜索.md` 或 `prompts/赛道热点/<track_id>/热点搜索.md` | 用赛道方向抓赛道池；提示词已要求直接输出可入池 JSON |
| 赛道专属分析提示词 | `prompts/分析提示词/<track_id>/赛道分析.md` | 手工跑 generate 时可一起贴给 LLM |
| 跑前 / 跑后状态检查 | `scripts/status.py` | `--preflight` 跑前检查；无参数 full status 跑后验收 |
| 生成提示词 | `scripts/make-prompt.py` | 负责拼变量、写 prompt 文件；不建议频繁改 |
| 安装今日结果 | `scripts/ingest.py` | 唯一安装闸门；不要绕过 |
| 同步预检 | `scripts/sync-to-db.py --dry-run` | 默认只 dry-run |
| 今日页面 API | `app/api/today/route.ts` | 只读 today/latest |
| 反馈 API | `app/api/feedback/route.ts` | 收集反馈，进入本地 fallback 或 feedback inbox |

### 2.1 新文件以后放哪里

这张表是交接给资深工程师的放置规则。原则是：长期配置进 `config/`，每日事实进 `data/`，方法论进 `prompts/`，正式安装只走 `scripts/ingest.py`，页面/API 不直接生成 today。

| 新增内容 | 应放位置 | 命名规则 / 例子 | 必要后续动作 |
|---|---|---|---|
| 新账号 | `data/accounts/<account_id>.json` | `acct-<brand>-<platform>-<role>.json`，如 `acct-xiaozhu-edu-xhs.json` | 跑 `python3 scripts/status.py --date <date> --preflight <account_id>` |
| 新赛道 | `config/tracks/<track_id>.json` | `education-yowow.json`、`razor-personalcare.json` | 补 `prompts/赛道热点/<track_id>/热点搜索.md` 和 `prompts/分析提示词/<track_id>/赛道分析.md`，再跑 preflight |
| 新平台 | `config/platforms/<platform_id>.json` | `douyin.json`、`xiaohongshu.json`、`bilibili.json` | 确认 `scripts/make-prompt.py` 能读到平台规则 |
| 新人设 / 账号定位 | `config/positionings/<positioning_id>.json` | `boss.json`、`expert.json` | 账号 JSON 引用该 `positioning_id` |
| 公共热点池 | `data/hotspots/<date>.json` | `data/hotspots/2026-06-30.json` | 可由 `/ops` 保存；生成 match 前必须存在 |
| 赛道热点池 | `data/hotspots/tracks/<track_id>/<date>.json` | `data/hotspots/tracks/education-yowow/2026-06-30.json` | 目标赛道 fresh-run 前必须存在 |
| 新公共热点抓取提示词 | `prompts/公共热点/来源注册/<中文名>.md` | 候选：`prompts/公共热点/来源注册/人物言论雷达.md` | `/ops` 自动扫描；通常不用改代码。改扫描规则时才补 `test/ops-workbench.test.mjs` |
| 新赛道搜索提示词 | `prompts/赛道热点/<track_id>/热点搜索.md` | `prompts/赛道热点/razor-personalcare/热点搜索.md` | 输出必须是可入池热点 JSON 数组 |
| 新赛道分析提示词 | `prompts/分析提示词/<track_id>/赛道分析.md` | `prompts/分析提示词/education-yowow/赛道分析.md` | 会被 `scripts/make-prompt.py` 注入 generate prompt 的 `{track_analysis}` |
| match/generate 回贴 | `data/runs/<date>/<account_id>/_inbox/` | `match-<hotspot_id>.json`、`generate-<hotspot_id>.json` | 文件名和 JSON 里的 `hotspot_id` 必须一致 |
| 生成出来的提示词 | `data/runs/<date>/<account_id>/prompts/` | `match-*.txt`、`generate-*.txt` | 只由 `scripts/make-prompt.py` 写，不手工补 |
| 安装后的今日结果 | `data/today/<account_id>/<date>.json` 和 `latest.json` | 由 ingest 写入 | 不手写；只能由 `scripts/ingest.py` 安装 |
| 本地反馈归档 | `data/runs/<date>/<account_id>/feedback-inbox/` 或 `feedback/` | JSON 文件 | 第二天跑批前人工查看或带入上下文 |
| 新前端页面 | `app/<route>/page.tsx` | `app/ops/page.tsx` | 如果需要共享组件，放 `components/adaptation/` |
| 新 API | `app/api/<name>/route.ts` | `app/api/ops/prompts/route.ts` | 不能绕过 `ingest.py` 写 `data/today/` |
| 新 UI 组件 | `components/adaptation/<Name>.tsx` | `OpsWorkbench.tsx` | 用户可见文案不能暴露内部术语或分数 |
| 新共享读取/服务逻辑 | `lib/<domain>.ts` | `ops-workbench.ts`、`file-data.ts` | 不放核心安装闸门；安装仍在 Python ingest |
| 新本地脚本 | `scripts/<verb>-<object>.py` 或 `.mjs` | `status.py`、`validate-configs.mjs` | 加 `--selftest` 或测试覆盖，更新 `scripts/README.md` |
| 新测试 | `test/*.test.mjs` 或 `e2e/*.spec.ts` | `test/ops-workbench.test.mjs` | 涉及页面按钮跑 `npm run test:e2e` |
| 新交接文档 | `docs/*.md` | 主文档优先补 `MVP-ARCHITECTURE-HANDOFF.md` | 不重复维护命令；入口写到 `docs/README.md` |
| 历史废弃文件 | `docs/archive/` | `docs/archive/code-history/*.md` | 不直接删除有参考价值的旧实现，先归档 |

### 2.2 新提示词的落地流程

新增提示词不要只把 prompt 文件丢进 `prompts/`。按下面顺序落地：

1. 先明确它属于哪类入口：公共热点、赛道热点、match、generate、onboarding、赛道分析、桥梁母题。
2. 公共热点提示词放到 `prompts/公共热点/来源注册/<中文名>.md`，输出必须能直接粘到 `/ops` 的“粘贴全网热点结果”，最终进入 `data/hotspots/<date>.json`；`/ops` 会自动展示复制卡片。
3. 赛道热点提示词放 `prompts/赛道热点/<track_id>/热点搜索.md`，输出进入 `data/hotspots/tracks/<track_id>/<date>.json`。
4. 赛道分析提示词放 `prompts/分析提示词/<track_id>/赛道分析.md`，由 generate prompt 注入，不单独写入热点池。
5. 公共热点提示词通常不需要接代码；只有要修改 `prompts/公共热点/来源注册/` 自动扫描规则时，才更新 `lib/ops-workbench.ts` 并补 `test/ops-workbench.test.mjs`。
6. 更新 `prompts/README.md` 和 `docs/OPERATIONS-LLM-RUNBOOK.md`，说明谁用它、输出粘到哪里。
7. 跑 `npm run test`；如果改了 `/ops` 交互，再跑 `npm run test:e2e`。

当前候选但尚未落地的提示词：

| 候选提示词 | 建议路径 | 状态 | 接入点 |
|---|---|---|---|
| 人物言论雷达 | `prompts/公共热点/来源注册/人物言论雷达.md` | 草稿已存在，`enabled:false`，未启用 | 改为 `enabled:true` 后 `/ops` 自动扫描；输出进 `data/hotspots/<date>.json` |

#### 公共热点提示词怎么加

公共热点提示词是全赛道共享入口，只负责找原料，不负责判断哪个账号能不能发。

路径：

```text
prompts/公共热点/来源注册/<中文名>.md
```

例子：

```text
prompts/公共热点/来源注册/人物言论雷达.md
```

文件头最小格式：

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

输出必须是公共热点池 JSON 数组，保存到：

```text
data/hotspots/<date>.json
```

只要文件放在 `prompts/公共热点/来源注册/` 且 `enabled` 不是 `false`，它就会在 `/ops` 页面顶部出现一个“复制提示词”按钮。临时隐藏时把 `enabled` 改成 `false`。

公共热点提示词的硬要求：

- 不能写具体赛道推荐。
- 不能写账号内容草稿。
- 不能输出 Markdown 解释。
- 只输出可入池 JSON 数组。
- `hotspot_id` 要唯一；正式提示词里应要求 LLM 生成稳定 ID。

#### 赛道热点提示词怎么加

赛道热点提示词是某个赛道专用入口，用该赛道的搜索方向召回更相关的热点。

路径：

```text
prompts/赛道热点/<track_id>/热点搜索.md
```

例子：

```text
prompts/赛道热点/education-yowow/热点搜索.md
prompts/赛道热点/razor-personalcare/热点搜索.md
```

输出必须是赛道热点池 JSON 数组，保存到：

```text
data/hotspots/tracks/<track_id>/<date>.json
```

例如：

```text
data/hotspots/tracks/education-yowow/2026-06-30.json
```

赛道热点提示词通常不需要额外接 `/ops`。`/ops` 会根据当前账号的 `track_id` 优先读取：

```text
prompts/赛道热点/<track_id>/热点搜索.md
```

如果该文件不存在，才退回通用模板：

```text
prompts/赛道热点/通用赛道热点搜索.md
```

公共热点和赛道热点的区别：

| 类型 | 放置路径 | 输出路径 | 影响范围 |
|---|---|---|---|
| 公共热点提示词 | `prompts/公共热点/来源注册/<中文名>.md` | `data/hotspots/<date>.json` | 所有赛道共享 |
| 赛道热点提示词 | `prompts/赛道热点/<track_id>/热点搜索.md` | `data/hotspots/tracks/<track_id>/<date>.json` | 只影响该赛道 |

加完后至少跑：

```bash
python3 scripts/status.py --date <date> --preflight <account_id>
python3 scripts/make-prompt.py <account_id> --date <date> --step match
npm run test
```

### 2.3 资深工程师第一天接手路线

建议不要从历史文档或 archive 开始。按这个顺序读和跑：

1. 读本文的 `Current Final Status`、`Project Memory Snapshot`、`当前 MVP 到底是什么`。
2. 读 `docs/CODE-MAP.md`，确认当前主链路和历史废弃路径。
3. 读 `docs/RUNBOOK.md`，理解终端跑批；再打开 `/ops` 理解按钮化流程。
4. 跑 `python3 scripts/status.py --date 2026-06-30 --preflight acct-xiaozhu-edu-xhs` 验证教育账号输入齐全。
5. 跑 `npm run test` 和 `npm run typecheck`，确认前端和本地脚本仍在当前绿线。
6. 如果要改提示词，先改 `prompts/公共热点/`、`prompts/赛道热点/`、`prompts/分析提示词/` 或 `prompts/新增账号与赛道接入/`，不要先改 `scripts/make-prompt.py`。
7. 如果要改安装规则，先读 `scripts/ingest.py` 和 `test/` 里对应测试；这是最敏感边界。
8. 如果要上线或同步，先读 `docs/MVP-ACCEPTANCE.md` 和 `docs/RUNBOOK.md` 的 sync 边界，拿负责人授权。

---

## 3. 每个提示词在哪里改

格式权威来源：

- match 回贴格式以 `prompts/分析提示词/热点匹配判断.md` 和 `scripts/ingest.py` 为准。
- generate 回贴格式以生成的 `generate-*.txt`、`prompts/分析提示词/内容生成.md` 和 `scripts/ingest.py` 为准。
- 本文示例只作为最小参考；如果和 prompt / ingest 冲突，以 prompt / ingest 为准。

### 3.1 `prompts/分析提示词/热点匹配判断.md`

用途：判断一条热点对某赛道是 `strong_pick / maybe / skip`。

改这里会影响：

- 热点是否推荐。
- “为什么推给你”的理由。
- 哪些热点被跳过。

不要删这些占位符：

```text
{date}
{track}
{track_json}
{anxiety_anchors}
{internal_lens}
{forbidden_terms}
{hotspot}
```

match 回贴最小可接收形状：

```json
{
  "tier": "strong_pick",
  "relevance_score": 8.0,
  "naturalness_score": 8.0,
  "why_relevant": "这条热点戳中的真实焦虑，能自然接到这个账号的客户问题。",
  "skip_reason": null
}
```

skip 回贴最小可接收形状：

```json
{
  "tier": "skip",
  "relevance_score": 2.0,
  "naturalness_score": 2.0,
  "why_relevant": "",
  "skip_reason": "这条热度虽高，但跟这个账号的生意关系弱，硬接会显得牵强。"
}
```

说明：

- 文件名必须是 `match-<hotspot_id>.json`；如果 JSON 里写了 `hotspot_id`，必须和文件名一致。
- `tier` 只能是 `strong_pick / maybe / skip`。
- `skip_reason` 字段必须存在；`tier=skip` 时不能为空。
- 非 skip 必须有 `why_relevant`。

### 3.2 `prompts/分析提示词/内容生成.md`

用途：把非 skip 热点生成内容方案。

改这里会影响：

- 桥梁路径怎么写。
- 标题和开头怎么写。
- 正文 / 脚本结构。
- 风险提醒怎么表达。

不要删这些占位符：

```text
{track_json}
{product_value}
{proof_assets}
{anxiety_anchors}
{bridge_motifs}
{internal_lens}
{external_vocab}
{forbidden_terms}
{platform_json}
{positioning_voice}
{hotspot}
```

generate 回贴不要在交接文档里手写简化版。它字段多，容易因为漏 `bridge_paths` 的 5 步链而被 `ingest.py` 拒收。以生成的 `data/runs/<date>/<account_id>/prompts/generate-<hotspot_id>.txt` 里的 JSON schema 为准。

最低规则：

- `recommendation` 只能是 `strong_pick / maybe / skip`。
- 非 skip 必须有至少 3 条 `bridge_paths`。
- 每条 `bridge_paths` 必须有 5 个字段：`phenomenon`、`real_problem`、`track_relation`、`product_value_support`、`platform_expression`。
- 非 skip 必须有 `content.topic`、`content.title`、`content.body_or_script`。
- `external_terms_check` 必须是 `true`。

### 3.3 赛道记忆怎么进入提示词

`make-prompt.py` 会把赛道 JSON 和账号 JSON 合并成 `effective_track`：

```text
config/tracks/<track_id>.json
  + data/accounts/<account_id>.json 的 memory
  -> effective_track
  -> match 用 {account_match_card}
  -> generate 用 {track_json}
```

真实代码位置：

```text
scripts/make-prompt.py
  build_effective_track()
  build_match_vars()
  build_generate_vars()
```

进入提示词的位置：

```text
prompts/分析提示词/热点匹配判断.md
  ## 账号判断卡
  {account_match_card}

prompts/分析提示词/内容生成.md
  ## 这条赛道
  {track_json}
```

字段影响：

| 字段 | 影响 |
|---|---|
| `anxiety_anchors` | match 判断热点是否戳中客户焦虑；generate 写真实问题 |
| `product_value` | generate 落产品价值 |
| `proof_assets` | generate 只能用真实证据，不许编 |
| `bridge.external_vocab` | generate 用哪些对外人话搭桥 |
| `bridge.forbidden_terms` | ingest 成品禁词硬门 |
| `bridge.search_directions` | 准备赛道热点池时参考 |
| `content_style` | 账号口吻 |
| `banned_topics` | 判断和生成时的禁区参考 |

---

## 4. 没有 agent 时，怎么用外部 LLM 跑完整流程

示例：

```bash
D=2026-06-29
ACCT=acct-xiaozhu-edu-xhs
```

### 4.1 跑前检查

```bash
python3 scripts/status.py --date $D --preflight $ACCT
```

通过标准：

```text
Missing / action needed:
  (none)
```

如果缺热点池，先补：

```text
data/hotspots/$D.json
data/hotspots/tracks/<track_id>/$D.json
```

### 4.2 生成 match 提示词

```bash
python3 scripts/make-prompt.py $ACCT --date $D --step match
```

输出位置：

```text
data/runs/$D/$ACCT/prompts/match-<hotspot_id>.txt
```

操作：

1. 打开一个 `match-*.txt`。
2. 整段复制到外部 LLM。
3. 要求模型只输出 JSON。
4. 把回答保存成 `data/runs/$D/$ACCT/_inbox/match-<hotspot_id>.json`。

### 4.3 生成 generate 提示词

```bash
python3 scripts/make-prompt.py $ACCT --date $D --step generate
```

输出位置：

```text
data/runs/$D/$ACCT/prompts/generate-<hotspot_id>.txt
```

操作：

1. 只处理 match 里 `strong_pick / maybe` 的热点。
2. 打开对应 `generate-*.txt`。
3. 整段复制到外部 LLM。
4. 如果该赛道有 `prompts/分析提示词/<track_id>/赛道分析.md`，可以一起贴给 LLM。
5. 把回答保存成 `data/runs/$D/$ACCT/_inbox/generate-<hotspot_id>.json`。

### 4.4 安装结果

```bash
python3 scripts/ingest.py $ACCT data/runs/$D/$ACCT/_inbox --date $D
```

成功后会写：

```text
data/today/$ACCT/$D.json
data/today/$ACCT/latest.json
data/runs/$D/$ACCT/installed.json
data/runs/$D/$ACCT/manifest.json
data/runs/$D/$ACCT/raw/
```

### 4.5 跑后检查

```bash
python3 scripts/status.py --date $D
```

### 4.6 打开网站

```bash
npm run dev
```

```text
http://127.0.0.1:3000
```

### 4.7 同步预检

日常默认只执行：

```bash
python3 scripts/sync-to-db.py --dry-run
```

正式同步不是日常必做。如果不确定 Turso 环境，不能执行：

```bash
python3 scripts/sync-to-db.py
```

正式 `python3 scripts/sync-to-db.py` 只有在确认 Turso 是安全 dev/test 环境，或负责人明确授权后执行。

---

## 5. /onboarding 的定位

`/onboarding` 可以生成账号 JSON / 赛道 JSON 草稿，但当前 MVP 不在线保存。

正确流程：

1. 打开 `http://127.0.0.1:3000/onboarding`。
2. 填问卷。
3. 复制账号 JSON，手动保存到 `data/accounts/<account_id>.json`。
4. 如是新赛道，复制赛道 JSON 草稿，手动保存到 `config/tracks/<track_id>.json`。
5. 跑：

```bash
python3 scripts/status.py --date 2026-06-29 --preflight <account_id>
```

通过后才能进入每日跑批。

`/onboarding` 不是线上自助入驻系统，不是审批流，不写数据库，也不自动创建线上账号。

---

## 6. sync-to-db 边界

- 日常默认只执行 `python3 scripts/sync-to-db.py --dry-run`。
- 正式 `python3 scripts/sync-to-db.py` 只有在确认 Turso 是安全 dev/test 环境，或负责人明确授权后执行。
- 如果不确定环境，不能正式同步。
- 正式同步不代表业务 MVP 完成，也不代表 razor 赛道 approved。

---

## 7. 当前不能做什么

当前 MVP 不能做：

- 不能宣布正式业务 MVP 完成。
- 不能宣布 razor 赛道正式 approved。
- 不能说已经上线。
- 不能说博士已签 T-M0.2 / T-M1.2。
- 不能默认执行正式 `sync-to-db.py`。
- 不能让 API、页面、LLM 绕过 `ingest.py` 写 `data/today/`。
- 不能把 `/onboarding` 描述成线上自助入驻系统。
- 不能新增登录、权限、RBAC、付费、多租户隔离来“补 MVP”。

---

## 8. 工程师改动边界

可以改：

- `docs/` 文档。
- `prompts/*.md` 提示词。
- `config/tracks/*.json` 赛道配置。
- `data/accounts/*.json` 账号配置。
- `app/onboarding/page.tsx` 问卷 UI。
- `lib/onboarding-questionnaire.mjs` 问卷到 JSON 的映射。

谨慎改：

- `scripts/make-prompt.py`：会影响所有提示词渲染。
- `scripts/ingest.py`：会影响安装硬门。
- `app/api/today/route.ts`：必须保持只读。
- `scripts/sync-to-db.py`：可能影响线上镜像。

不要改：

- 不要让 API 直接写 `data/today/<account_id>/latest.json`。
- 不要绕过 `ingest.py` 安装结果。
- 不要把 Turso 改成主数据库。
- 不要新增登录、权限、付款、多租户，当前 MVP 不需要。

---

## 9. 快速定位表

| 问题 | 第一检查位置 |
|---|---|
| 页面没看到新账号 | `data/accounts/<account_id>.json` 是否存在；重启/刷新前端 |
| preflight 失败 | `scripts/status.py --date <date> --preflight <account_id>` 输出 |
| 没有 match prompt | 公共热点池/赛道热点池是否存在 |
| generate prompt 不对 | `_inbox/match-*.json` 是否完整，是否全是 skip |
| ingest 拒收 | 看终端错误；通常是 JSON 坏、缺桥梁 5 步、id 不一致、禁词命中 |
| 前端没更新 | `data/today/<account_id>/latest.json` 是否已由 ingest 写入 |
| 想改判断标准 | `prompts/分析提示词/热点匹配判断.md` |
| 想改生成风格 | `prompts/分析提示词/内容生成.md` 或账号 `memory.content_style` |
| 想改赛道搜索方向 | `config/tracks/<track_id>.json` 的 `bridge.search_directions` / `daily_search_question` |
| 想改账号禁词 | `data/accounts/<account_id>.json` 的 `memory.extra_forbidden_terms` |
