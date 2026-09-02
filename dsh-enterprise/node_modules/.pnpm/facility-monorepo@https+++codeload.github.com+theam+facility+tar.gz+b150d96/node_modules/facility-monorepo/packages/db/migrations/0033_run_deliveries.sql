CREATE TABLE run_deliveries (
  run_id text PRIMARY KEY REFERENCES runs(id),
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  repo_id text NOT NULL REFERENCES repos(id),
  owner text NOT NULL,
  repo_name text NOT NULL,
  head_branch text NOT NULL,
  expected_head_sha text NOT NULL,
  base_branch text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  issue_number integer,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  blocked_reason text,
  error text,
  pr_number integer,
  pr_url text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT run_deliveries_status_check
    CHECK (status IN ('pending', 'delivering', 'delivered', 'blocked')),
  CONSTRAINT run_deliveries_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX run_deliveries_pending_idx
  ON run_deliveries(status, next_attempt_at)
  WHERE status IN ('pending', 'delivering');

CREATE INDEX run_deliveries_org_project_idx
  ON run_deliveries(org_id, project_id, created_at DESC);

-- Older builds could create multiple active previews for the same run. Keep
-- every sandbox record for cleanup/audit, but detach all except the best active
-- candidate before enforcing the new idempotency key.
WITH ranked_active_previews AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY run_id
      ORDER BY
        CASE status WHEN 'running' THEN 0 WHEN 'provisioning' THEN 1 ELSE 2 END,
        created_at DESC,
        id DESC
    ) AS rank
  FROM preview_sandboxes
  WHERE run_id IS NOT NULL
    AND status IN ('provisioning', 'running')
)
UPDATE preview_sandboxes AS preview
SET
  run_id = NULL,
  error = concat_ws('; ', nullif(preview.error, ''), 'legacy_duplicate_run_detached'),
  updated_at = now()
FROM ranked_active_previews AS ranked
WHERE preview.id = ranked.id
  AND ranked.rank > 1;

CREATE UNIQUE INDEX preview_sandboxes_run_uidx
  ON preview_sandboxes(run_id)
  WHERE run_id IS NOT NULL
    AND status IN ('provisioning', 'running');
