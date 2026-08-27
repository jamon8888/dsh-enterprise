-- The charter and active docs get the same treatment as KB entries: freely
-- editable, prior content captured as versions, and a per-doc updated stamp so
-- the Product header can date them independently of the space row.
CREATE TABLE IF NOT EXISTS kb_space_doc_versions (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  space_id text NOT NULL REFERENCES kb_spaces(id) ON DELETE CASCADE,
  doc text NOT NULL CHECK (doc IN ('charter', 'active')),
  version integer NOT NULL,
  body_md text NOT NULL DEFAULT '',
  saved_by jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, doc, version)
);

CREATE INDEX IF NOT EXISTS kb_space_doc_versions_space_idx
  ON kb_space_doc_versions (space_id, doc, version DESC);

ALTER TABLE kb_spaces ADD COLUMN IF NOT EXISTS charter_updated_at timestamptz;
ALTER TABLE kb_spaces ADD COLUMN IF NOT EXISTS active_updated_at timestamptz;
