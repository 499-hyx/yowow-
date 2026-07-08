# components/ 目录说明

这里放可复用 UI 组件。当前主要组件都在 `components/adaptation/`。

组件只负责展示、复制、反馈交互；不负责跑 LLM，不写 `data/today/`。

## adaptation 组件

| 组件 | 用途 |
|---|---|
| `AccountsWorkbench.tsx` | 账号工作台展示 |
| `OpsWorkbench.tsx` | `/ops` 本地跑批台交互主体 |
| `TodayBoard.tsx` | 今日内容决策台 |
| `RecommendationCard.tsx` | 单条推荐 / 跳过卡片 |
| `FeedbackBar.tsx` | 卡片反馈 |
| `FeedbackV1Box.tsx` | 反馈 V1 展示/输入 |
| `MemoryEditor.tsx` | 账号记忆展示/本地编辑入口 |
| `SparkInbox.tsx` | 灵感入口 |
| `OnboardingWizard.tsx` | 早期向导组件，当前 `/onboarding` 主要使用 `app/onboarding/page.tsx` |
| `CopyTextButton.tsx` | 复制按钮 |
| `DateContextBar.tsx` | 日期上下文 |

## 红线

- 组件不直接写 `data/today/`。
- 组件不调用 LLM 生成正式内容。
- 用户可见文案不能暴露内部术语或分数。
