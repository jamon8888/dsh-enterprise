-- Migration 003: Receipt chain integrity
-- Adds receipt_genesis singleton + trigger enforcing prev_hash chain linkage.
-- Each INSERT checks that prev_hash == genesis OR matches the latest receipt hash.

-- Singleton table storing the genesis hash value
CREATE TABLE IF NOT EXISTS receipt_genesis (
    id TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Initialize genesis if not present
INSERT INTO receipt_genesis (id, value) VALUES ('singleton', 'genesis')
    ON CONFLICT (id) DO NOTHING;

-- Function: enforce receipt chain integrity
-- Each new receipt's prev_hash must equal the hash of the most recent prior receipt.
CREATE OR REPLACE FUNCTION enforce_receipt_chain()
RETURNS TRIGGER AS $$
DECLARE
    genesis_val TEXT;
    prev_hash_found TEXT;
BEGIN
    -- Get genesis value
    SELECT value INTO genesis_val FROM receipt_genesis WHERE id = 'singleton';

    -- If prev_hash is genesis, this is a first receipt (after genesis) — allow if table is empty
    IF NEW.prev_hash = genesis_val THEN
        -- Allow only if no receipts exist yet
        IF EXISTS (SELECT 1 FROM receipts LIMIT 1) THEN
            -- Check if this IS the first receipt (no prior hashes)
            IF NOT EXISTS (SELECT 1 FROM receipts WHERE hash = genesis_val) THEN
                RAISE EXCEPTION 'prev_hash is genesis but genesis receipt already exists';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- prev_hash must match the most recent receipt's hash
    SELECT hash INTO prev_hash_found
    FROM receipts
    ORDER BY built_at DESC
    LIMIT 1;

    IF prev_hash_found IS NULL THEN
        RAISE EXCEPTION 'prev_hash "%" is not genesis and no prior receipts exist', NEW.prev_hash;
    END IF;

    IF NEW.prev_hash != prev_hash_found THEN
        RAISE EXCEPTION 'prev_hash "%" does not match latest receipt hash "%"', NEW.prev_hash, prev_hash_found;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: fire after insert on receipts
DROP TRIGGER IF EXISTS trigger_enforce_receipt_chain ON receipts;
CREATE CONSTRAINT TRIGGER trigger_enforce_receipt_chain
    AFTER INSERT ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION enforce_receipt_chain();

-- Record this migration
INSERT INTO schema_migrations (version, name) VALUES (3, 'receipt_chain_integrity')
    ON CONFLICT (version) DO NOTHING;
