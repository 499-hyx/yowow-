# data/ 目录说明

这里放本地事实数据和跑批产物。网站默认只读这里和 `config/`。

## 目录

| 路径 | 用途 |
|---|---|
| `accounts/<account_id>.json` | 当前真实账号档案和账号记忆 |
| `hotspots/<date>.json` | 公共热点池 |
| `hotspots/tracks/<track_id>/<date>.json` | 赛道热点池 |
| `runs/<date>/<account_id>/prompts/` | `make-prompt.py` 生成的提示词快照 |
| `runs/<date>/<account_id>/_inbox/` | 外部 LLM / agent / 人工回贴，只允许这里人工写 |
| `runs/<date>/<account_id>/raw/` | `ingest.py` 归档后的原始回贴，不手写 |
| `runs/<date>/<account_id>/installed.json` | `ingest.py` 生成的安装摘要，不手写 |
| `runs/<date>/<account_id>/manifest.json` | 跑批记录，由脚本生成/更新，不手写 |
| `today/<account_id>/<date>.json` | 某账号某天安装后的结果 |
| `today/<account_id>/latest.json` | 网站读取的最新结果 |
| `deleted/` | 删除/迁移时保留的历史备份 |

## 红线

- 不要手写 `data/today/<account_id>/latest.json`。
- 今日结果只能由 `scripts/ingest.py` 安装。
- `_inbox/` 里可以放外部 LLM / agent / 人工回贴，坏 JSON 会被 `ingest.py` 拒收。
- `prompts/`、`raw/`、`installed.json`、`manifest.json` 是审计记录，通常由脚本维护；人工只需要准备热点池和 `_inbox`。
- `data/runs/` 是审计记录，不要为了“干净”随便删。

## 日常入口

```bash
python3 scripts/status.py --date <date> --preflight <account_id>
python3 scripts/make-prompt.py <account_id> --date <date> --step match
python3 scripts/make-prompt.py <account_id> --date <date> --step generate
python3 scripts/ingest.py <account_id> data/runs/<date>/<account_id>/_inbox --date <date>
```
