-- Support the incremental analytics rollup's trailing-window scan. The rollup
-- filters each source by a time bound (created_at / terminal_at) with no leading
-- org/project predicate, so it needs indexes that lead with the time column to
-- turn a full-table scan into a range scan of just the rebuilt window.
CREATE INDEX IF NOT EXISTS runs_created_idx
  ON runs (created_at);

CREATE INDEX IF NOT EXISTS llm_requests_created_idx
  ON llm_requests (created_at);

CREATE INDEX IF NOT EXISTS outcomes_terminal_idx
  ON outcomes (terminal_at);
