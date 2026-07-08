# docs/archive/ 归档说明

这里放历史方案、旧流程和早期内部说明。归档不是删除，只是避免旧文档冒充当前流程。

## 目录

| 目录 | 内容 |
|---|---|
| `design-history/` | 历史产品 / 前端设计方案 |
| `code-history/` | 已移出活代码路径的历史代码 |
| `legacy-runbooks/` | 旧跑批流程、旧外部 LLM 接法、新赛道旧接入文档 |
| `legacy-root/` | 早期放在项目根目录的内部说明 |

## 使用规则

- 查当前工程状态：读 `docs/MVP-ARCHITECTURE-HANDOFF.md`。
- 查当前日常跑批：读 `docs/RUNBOOK.md`。
- 查当前验收口径：读 `docs/MVP-ACCEPTANCE.md`。
- 查普通同事使用方式：读 `docs/同事使用指南.md`。
- archive 里的文档只作历史参考，不作为 agent 或工程师执行依据。
- `code-history/` 里的 `.ts.md` 和说明文件不是可编译源码，不要 import。
