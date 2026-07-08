# config/tracks/ 赛道事实源

这里每个 JSON 文件代表一条赛道。文件名必须和 JSON 内的 `track_id` 一致：

```text
config/tracks/<track_id>.json
```

## 为什么文件名暂时不改中文

`track_id` 是系统主键，不是展示名。它同时被这些地方使用：

- `data/accounts/<account_id>.json` 的 `track_id`
- `prompts/赛道热点/<track_id>/热点搜索.md`
- `prompts/分析提示词/<track_id>/赛道分析.md`
- `data/hotspots/tracks/<track_id>/<date>.json`
- `scripts/status.py`、`scripts/make-prompt.py`
- 赛道页、热点页、回归测试和同步脚本

中文赛道名请写在 JSON 的 `track_name` 字段里。

## 新增赛道最小文件

```text
config/tracks/<track_id>.json
prompts/赛道热点/<track_id>/热点搜索.md
prompts/分析提示词/<track_id>/赛道分析.md
data/accounts/<account_id>.json
```

## 现有赛道

| 文件 | 中文名 | 状态 |
|---|---|---|
| `education-yowow.json` | 小朱教育 / 远场学习适配 | 现有教育赛道 |
| `fitness-coaching.json` | 健身教练 | 新赛道样例 |
| `petfood-sourcing.json` | 宠物食品源头供应 | 新赛道样例 |
| `razor-personalcare.json` | 男士个护 / 剃须刀 | 剃须刀样例 |
