CREATE TABLE preview_access_handoffs (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  preview_id text NOT NULL REFERENCES preview_sandboxes(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX preview_access_handoffs_expiry_idx
  ON preview_access_handoffs(expires_at);

CREATE INDEX preview_access_handoffs_preview_user_idx
  ON preview_access_handoffs(preview_id, user_id);
