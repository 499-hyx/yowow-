# docs/ 文档入口

本文只负责告诉接手人“先读哪个文档”。整个 workspace 的交接包在根目录 `交接文档/`；不要把 archive 里的历史方案当成当前流程。

## 当前主文档

| 读者 / 场景 | 先读 |
|---|---|
| 第一次交接 | `../../交接文档/00-先看这里-交接入口.md` |
| 工程师项目全图 | `../../交接文档/01-工程师项目全图.md` |
| 工程师第一天接手 | `../../交接文档/02-第一天接手清单.md` |
| 日常跑批流程 | `../../交接文档/03-日常跑批流程.md` |
| 提示词和热点入口 | `../../交接文档/04-提示词和热点入口.md` |
| 跑批闭环专项 | `../../交接文档/附录/08-跑批闭环专项.md` |
| 工程师接手 | `docs/MVP-ARCHITECTURE-HANDOFF.md` |
| 查看当前项目记忆 / 最新运维事实 | `docs/MVP-ARCHITECTURE-HANDOFF.md` 的 `Project Memory Snapshot` |
| 查“新增文件/提示词/前端/API 放哪里” | `docs/MVP-ARCHITECTURE-HANDOFF.md` 的 `2.1 新文件以后放哪里` |
| 新增公共热点提示词 | `prompts/公共热点/来源注册/说明.md` |
| 每日跑批 | `docs/RUNBOOK.md` |
| 没有 agent，用外部 LLM 跑全业务闭环 | `docs/OPERATIONS-LLM-RUNBOOK.md` |
| 判断 MVP 状态 | `docs/MVP-ACCEPTANCE.md` |
| 普通同事试用 | `docs/同事使用指南.md` |
| 想理解 6 个 Loop | `docs/LOOP-SPEC.md` |
| 想找代码模块 | `docs/CODE-MAP.md` |

## 参考资料

| 文件 | 用途 |
|---|---|
| `docs/doctor-hotspot-doctrine.md` | 博士热点判断方法论出处，赛道配置里的 `analysis_doctrine` 来源 |
| `docs/education-yowow-standard.md` | 教育标杆赛道说明 |

参考资料不是每日操作入口。日常命令仍以 `docs/RUNBOOK.md` 为准；没有 agent 时，以 `docs/OPERATIONS-LLM-RUNBOOK.md` 为准。

## 归档区

历史文档放在：

```text
docs/archive/
```

归档文档只用于追溯设计演变，不代表当前系统状态。当前状态以 `docs/MVP-ARCHITECTURE-HANDOFF.md`、`docs/RUNBOOK.md`、`docs/OPERATIONS-LLM-RUNBOOK.md`、`docs/MVP-ACCEPTANCE.md` 和当前代码为准。
