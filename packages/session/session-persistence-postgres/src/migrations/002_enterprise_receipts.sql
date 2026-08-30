-- Migration 002: Enterprise receipts hash chain (watchtower)
-- Extends session-persistence-postgres for dsh-enterprise watchtower receipts.
-- Chain: receipts[i].prev_hash = receipts[i-1].hash (genesis = sha256("genesis"+orgId)), log_hash = sha256(canonical run.log)

CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    prev_hash TEXT,
    log_hash TEXT,
    outcome TEXT,
    cost JSONB,
    guard_dispositions JSONB,
    built_at BIGINT,
    builder JSONB
);

CREATE INDEX IF NOT EXISTS idx_receipts_run_id ON receipts(run_id);
CREATE INDEX IF NOT EXISTS idx_receipts_session_id ON receipts(session_id);
CREATE INDEX IF NOT EXISTS idx_receipts_hash ON receipts(hash);
CREATE INDEX IF NOT EXISTS idx_receipts_prev_hash ON receipts(prev_hash);

-- Record this migration
INSERT INTO schema_migrations (version, name) VALUES (2, 'enterprise_receipts') ON CONFLICT (version) DO NOTHING;
