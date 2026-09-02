-- Run-scoped platform (fak_) keys must share the virtual key's lifecycle. Until
-- now api_keys had neither a run link nor an expiry, so a crash between a run's
-- terminal-status commit and its best-effort key revoke could leave a live fak_
-- key with no backstop (the reconciler only swept virtual_keys). Give the
-- run-scoped platform key the run it belongs to and an expiry so it can be swept
-- when its run goes terminal and is rejected once expired.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS run_id text REFERENCES runs (id);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Support the reconciler's orphaned-key sweep on both key tables: revoke live
-- keys whose run has gone terminal. Partial (revoked_at IS NULL) so the working
-- set is only genuine live keys, keeping the sweep a bounded index scan.
CREATE INDEX IF NOT EXISTS api_keys_run_live_idx
  ON api_keys (run_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS virtual_keys_run_live_idx
  ON virtual_keys (run_id) WHERE revoked_at IS NULL;
