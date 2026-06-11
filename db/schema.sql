-- yowow-adaptation · Turso 文档式镜像 schema
-- 设计原则：本地 data/ + config/ 的 JSON 文件是唯一事实源；
-- 库里只是文件的镜像（docs 表），网站只读。schema 即合约：JSON 内容不在库里拆字段。
-- 唯一的"网站写"是 feedback_inbox（同事打分），由 scripts/pull-feedback.py 拉回本地归档。

CREATE TABLE IF NOT EXISTS docs (
  kind        TEXT NOT NULL,             -- account / today / hotspots_broad / hotspots_track /
                                         -- track_config / bridge_directions / platform / positioning
  key         TEXT NOT NULL,             -- account_id ｜ "<acct>/<date|latest>" ｜ date ｜ "<track>/<date>" ｜ id
  body        TEXT NOT NULL,             -- 原始 JSON 全文（ensure_ascii=False）
  updated_at  TEXT NOT NULL,             -- ISO 时间戳（同步时间）
  PRIMARY KEY (kind, key)
);

CREATE TABLE IF NOT EXISTS feedback_inbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL,
  date        TEXT NOT NULL,
  body        TEXT NOT NULL,             -- 反馈 JSON 全文
  created_at  TEXT NOT NULL,
  pulled_at   TEXT                       -- pull-feedback.py 拉走后盖章
);

CREATE INDEX IF NOT EXISTS idx_feedback_unpulled ON feedback_inbox (pulled_at, account_id);
