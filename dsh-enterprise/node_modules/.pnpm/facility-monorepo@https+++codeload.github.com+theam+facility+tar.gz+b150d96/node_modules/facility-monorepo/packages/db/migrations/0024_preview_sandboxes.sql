CREATE TABLE preview_sandboxes (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  repo_id text REFERENCES repos(id),
  run_id text REFERENCES runs(id),
  pr_number integer,
  commit_sha text,
  driver text NOT NULL,
  ref text,
  status text NOT NULL DEFAULT 'provisioning',
  auth_mode text NOT NULL DEFAULT 'workos_sso',
  origin_url text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  expires_at timestamptz NOT NULL,
  last_health_at timestamptz,
  created_by jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_sandboxes_status_check
    CHECK (status IN ('provisioning', 'running', 'failed', 'expired', 'destroyed')),
  CONSTRAINT preview_sandboxes_auth_check CHECK (auth_mode = 'workos_sso'),
  CONSTRAINT preview_sandboxes_driver_check CHECK (driver IN ('docker', 'aws')),
  CONSTRAINT preview_sandboxes_port_check
    CHECK (((config->>'port') IS NULL) OR ((config->>'port')::integer BETWEEN 1 AND 65535))
);

CREATE INDEX preview_sandboxes_org_project_idx
  ON preview_sandboxes(org_id, project_id, created_at DESC);
CREATE INDEX preview_sandboxes_expiry_idx
  ON preview_sandboxes(status, expires_at)
  WHERE status IN ('provisioning', 'running');
