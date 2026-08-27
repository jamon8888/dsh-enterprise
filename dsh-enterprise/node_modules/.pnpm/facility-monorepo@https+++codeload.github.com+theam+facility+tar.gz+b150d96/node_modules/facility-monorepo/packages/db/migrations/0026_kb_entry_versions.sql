-- Pages are freely editable; history is the safety net. Every PATCH captures
-- the prior content here before applying the change.
CREATE TABLE IF NOT EXISTS kb_entry_versions (
  id text PRIMARY KEY,
  org_id text NOT NULL,
  entry_id text NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE,
  version integer NOT NULL,
  slug text NOT NULL,
  frontmatter jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_md text NOT NULL DEFAULT '',
  status text,
  saved_by jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, version)
);

CREATE INDEX IF NOT EXISTS kb_entry_versions_entry_idx
  ON kb_entry_versions (entry_id, version DESC);
