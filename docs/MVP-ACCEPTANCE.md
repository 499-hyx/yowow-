# MVP 验收文档

本文件定义当前 Loop Engineering MVP 是否可交接。当前 MVP 是 **single-admin internal MVP**：不包含登录、注册、RBAC、正式权限系统、多租户隔离或账号审批；所有内容生产由本地维护者/agent 跑批完成。验收以本地 `data/ + config/` 为事实源，以 `ingest.py` 安装结果为准；Turso 只是线上只读镜像和反馈收件箱。

工程师主交接文档是 `docs/MVP-ARCHITECTURE-HANDOFF.md`。本文只定义验收口径。

账号不再有启用/停用状态开关；账号 JSON 存在且字段完整即可本地跑批。`track.status` 只保留为赛道风险提示。本地工程验证可以允许非 `approved/reference` 赛道运行；输出保留 `needs_human_review=true`、`formal_approval=false`、`mvp_internal_only=true` 这类工程标记，意思是“内部工程产物，不代表对外上线或生产同步”。BUILD-SPEC 里的 `T-M0.2/T-M1.2` 是历史 human-gate 工单，agent 不能代签；它们不是同事新增账号的审批流程。

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

仍需负责人/博士决策：

- razor 是否进入正式 approval。
- T-M0.2 / T-M1.2 是否签字。
- 是否授权正式 `sync-to-db.py`。
- 是否配置生产 Vercel / Turso。

## A. MVP 完成定义

1. 一个教育账号能从热点池跑到 `data/today/<account_id>/latest.json`。
   - 当前候选：`acct-xiaozhu-edu-xhs`，赛道 `education-yowow` 当前为 `approved`。
2. 一个非教育账号能从热点池跑到 `data/today/<account_id>/latest.json`。
   - 当前工程状态：`acct-razor-douyin-boss` 可在 `razor-personalcare status=paused` 下完成本地 internal MVP run；产物是内部工程产物，不能当成对外上线或生产同步。
3. match 能区分 `strong_pick / maybe / skip`。
   - 由 `scripts/make-prompt.py --step match` 生成提示词，`scripts/ingest.py` 校验 `tier`。
4. generate 只对 `strong_pick / maybe` 或被允许生成的热点产出内容。
   - 操作上 skip 不生成；`ingest.py` 遇到 match=skip 会强制最终 skip。
5. `ingest.py` 能拒绝坏 JSON。
   - `python3 scripts/ingest.py --selftest` 覆盖 JSON/字段/id/桥梁/禁词硬门。
6. `status.py` 能明确显示缺失项。
   - 跑前用 `python3 scripts/status.py --date <YYYY-MM-DD> --preflight <account_id>` 检查 fresh-run 必要输入。
   - ingest 后用 `python3 scripts/status.py --date <YYYY-MM-DD>` 输出 full status 的 OK 和 Missing / action needed。
   - full status 在跑前因为缺 `prompts/_inbox/raw/today/latest` 而失败是正常待办，不代表 fresh-run 不能启动。
7. `sync-to-db.py --dry-run` 能跑。
   - dry-run 只枚举将同步的文档，不需要 Turso 凭据。
8. `sync-to-db.py` 是可选生产步骤，正式同步前必须有明确风险提示和环境确认。
   - 非 dry-run 会提示将用本地 `data/ + config/` 覆盖 Turso docs 镜像并清理多余 key。
   - 只有在确认 Turso 是安全 dev/test，或负责人明确授权生产同步后，才执行正式 `python3 scripts/sync-to-db.py`。
9. 网站账号页能读取 latest。
   - `app/api/today` 只读 `data/today/<account_id>/latest.json`；损坏时回退最近日期归档。
10. feedback 能提交并进入 `feedback_inbox` 或本地 fallback。
    - `app/api/feedback` 在 Turso 模式写 `feedback_inbox`，本地模式写 `data/runs/<date>/<account_id>/feedback-inbox/`。
11. `pull-feedback.py` 能把反馈拉回本地。
    - `python3 scripts/pull-feedback.py --selftest` 可本地验证落盘。
12. 接手人按 `docs/RUNBOOK.md` 能独立跑完整流程。
    - 目标闭环：`hotspots → match → generate → ingest → status → sync-to-db --dry-run → website → feedback`；正式 `sync-to-db` 是授权后的可选生产步骤。

## B. 不属于 MVP 的内容

- 在线实时生成
- 在线编辑账号记忆
- 用户自助在线 onboarding 写库（当前 `/onboarding` 只生成本地 JSON 草稿）
- 多租户权限系统
- 登录 / 注册 / RBAC / 正式组织隔离
- 正式审批流后台
- 付费系统
- 自动定时任务
- 自动爬热点
- 在线 regenerate
- 复杂 dashboard
- LLM 直接写数据库
- API 绕过 `ingest.py` 写 `data/today/<account_id>/latest.json`
- Turso 作为主数据库

## C. 验收命令

所有命令默认在 `yowow-adaptation/` 下执行；最后一条 `adaptation-core/verify.py` 在仓库根目录执行。

```bash
npm run typecheck
npm run test
npm run build
python3 scripts/status.py --date <YYYY-MM-DD>
python3 scripts/status.py --date <YYYY-MM-DD> --preflight <account_id>
python3 scripts/make-prompt.py <account_id> --date <YYYY-MM-DD> --step match
python3 scripts/make-prompt.py <account_id> --date <YYYY-MM-DD> --step generate
python3 scripts/ingest.py <account_id> data/runs/<date>/<account_id>/_inbox --date <date>
python3 scripts/sync-to-db.py --dry-run
python3 scripts/pull-feedback.py --selftest
cd ..
python3 adaptation-core/verify.py
```

可选离线自测：

```bash
python3 scripts/make-prompt.py --selftest
python3 scripts/ingest.py --selftest
python3 scripts/sync-to-db.py --selftest
node scripts/validate-configs.mjs
```

## D. 当前支持矩阵

| 能力 | 当前状态 | 证据 |
|---|---|---|
| 教育账号 fresh run | 支持 | `education-yowow` 为 `approved`，`acct-xiaozhu-edu-xhs` 字段完整，跑前用 `status.py --preflight` |
| 非教育账号 fresh run | 本地支持 / 对外未上线 | `acct-razor-douyin-boss` 可本地跑到 latest；`razor-personalcare` 仍为 `paused` 历史状态标签，输出带 internal MVP 标记 |
| match/generate 分步 | 支持 | `scripts/make-prompt.py --step match|generate` |
| 唯一安装闸门 | 支持 | `scripts/ingest.py` 写 `data/today`，`app/api/today` 只读 |
| 线上只读展示 | 支持 | `lib/data-source.ts` 有 Turso docs 只读路径 |
| feedback inbox | 支持 | `app/api/feedback` + `scripts/pull-feedback.py` |
| spark 线上写入 | 本地文件处理 | `app/api/spark` 在 Turso 模式拒绝直接写文件；灵感入池由本地文件流程处理 |
| 在线 regenerate | 明确不支持 | `app/api/regenerate` 固定返回 `ok:false` |

## E. 剩余决策

- 生产同步：是否配置生产 Turso / Vercel 连接。
- 对外发布：哪些账号可以对外展示，什么时候执行正式 `sync-to-db.py`。
- 反馈是否影响下一轮：MVP 只保证收集和回拉；是否据反馈改赛道/账号记忆，由本地维护者决定。
