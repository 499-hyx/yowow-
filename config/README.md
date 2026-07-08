# config/ 目录说明

这里放长期配置。它描述“账号/赛道/平台/人设应该是什么”，不是每天跑批产生的结果。

## 目录

| 路径 | 用途 |
|---|---|
| `tracks/<track_id>.json` | 赛道配置：判断标准、分析层、搜索方向、禁词 |
| `platforms/<platform_id>.json` | 平台规则：内容形态、标题逻辑、平台口吻 |
| `positionings/<positioning_id>.json` | 人设口吻：老板型、专家型、工厂源头型等 |
| `account-profiles/` | 早期种子账号配置，当前日常账号以 `data/accounts/` 为准 |
| `warm-start/` | 历史暖启动样例，不是每日正式产物 |
| `global-gate.json` | 全局禁词 / forced connection hints 单一来源 |
| `deprecated/` | 已废弃或迁移的配置备份 |

## 修改规则

- 新赛道优先新增或修改 `tracks/<track_id>.json`。
- 新增或修改赛道后，同时检查 `prompts/赛道热点/<track_id>/热点搜索.md` 和 `prompts/分析提示词/<track_id>/赛道分析.md` 是否存在且口径匹配。
- 新账号事实和记忆放在 `data/accounts/<account_id>.json`，不要复制一份到 `config/account-profiles/`。
- 改平台表达习惯才改 `platforms/`。
- 改人设口吻才改 `positionings/`。
- `deprecated/bridge-directions/` 只是旧搜索方向备份；当前真实搜索方向放在 `tracks/<track_id>.json` 的 `bridge.search_directions`。
- 改完配置后至少跑：

```bash
npm run test
python3 scripts/status.py --date <date> --preflight <account_id>
```
