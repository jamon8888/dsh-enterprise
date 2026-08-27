-- Enforce "at most one active version per registry item" as a DB invariant, so
-- bundle assembly and the runner (which key skills/contracts by name) can rely on
-- it regardless of which publish path ran. Publishing now deprecates prior active
-- versions in a transaction, but a partial unique index makes it non-bypassable.

-- First collapse any pre-existing multiple-active rows to the highest version
-- (older data predating the deprecate-on-publish fix), so the index can be built.
UPDATE registry_versions rv
SET status = 'deprecated', updated_at = now()
WHERE rv.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM registry_versions other
    WHERE other.item_id = rv.item_id
      AND other.status = 'active'
      AND other.version > rv.version
  );

CREATE UNIQUE INDEX IF NOT EXISTS registry_versions_one_active_uidx
  ON registry_versions (item_id)
  WHERE status = 'active';
