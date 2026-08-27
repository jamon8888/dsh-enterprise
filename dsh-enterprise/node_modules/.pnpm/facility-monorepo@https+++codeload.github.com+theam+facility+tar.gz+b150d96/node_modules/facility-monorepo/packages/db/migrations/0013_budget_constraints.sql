-- Budget scope/period/mode are enum-like invariants the gateway relies on to
-- enforce spend caps (an unrecognized value is silently un-enforced), and
-- limit_cents must be non-negative (a negative cap is meaningless; 0 is valid —
-- a hard 0 budget freezes all spend, distinct from enabled=false which disables
-- enforcement). The API validates on write, but these DB-level CHECKs backstop
-- EVERY path (HTTP POST/PATCH, the HITL executor, any future caller) so an
-- unenforceable or overbroad budget row can never be persisted.
ALTER TABLE budgets
  ADD CONSTRAINT budgets_scope_check CHECK (scope IN ('org', 'project', 'agent_def'));
ALTER TABLE budgets
  ADD CONSTRAINT budgets_period_check CHECK (period IN ('daily', 'weekly', 'monthly'));
ALTER TABLE budgets ADD CONSTRAINT budgets_mode_check CHECK (mode IN ('soft', 'hard'));
ALTER TABLE budgets ADD CONSTRAINT budgets_limit_cents_check CHECK (limit_cents >= 0);
