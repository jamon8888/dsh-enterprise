-- The gateway authenticates every model call by virtual-key prefix.
-- Without this index that lookup is a sequential scan on the hot path.
CREATE INDEX IF NOT EXISTS virtual_keys_prefix_idx ON virtual_keys (prefix);
