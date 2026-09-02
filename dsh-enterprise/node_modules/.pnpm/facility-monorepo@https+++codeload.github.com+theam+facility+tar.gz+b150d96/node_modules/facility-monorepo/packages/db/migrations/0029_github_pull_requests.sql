CREATE TABLE IF NOT EXISTS gh_pull_requests (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  repo_id text NOT NULL REFERENCES repos(id),
  number integer NOT NULL,
  title text NOT NULL,
  state text NOT NULL,
  draft boolean NOT NULL DEFAULT false,
  author text,
  head_ref text NOT NULL,
  head_sha text NOT NULL,
  base_ref text NOT NULL,
  html_url text NOT NULL,
  body_md text,
  closing_issues integer[] NOT NULL DEFAULT '{}',
  ci_state text,
  ci_head_sha text,
  ci_updated_at timestamptz,
  gh_created_at timestamptz,
  gh_updated_at timestamptz,
  closed_at timestamptz,
  merged_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_pull_requests_repo_number_uidx UNIQUE (repo_id, number),
  CONSTRAINT gh_pull_requests_state_check CHECK (state IN ('open', 'closed', 'merged')),
  CONSTRAINT gh_pull_requests_ci_state_check
    CHECK (ci_state IS NULL OR ci_state IN ('pending', 'success', 'failure'))
);

CREATE INDEX IF NOT EXISTS gh_pull_requests_org_project_state_idx
  ON gh_pull_requests(org_id, project_id, state);
CREATE INDEX IF NOT EXISTS gh_pull_requests_repo_head_sha_idx
  ON gh_pull_requests(repo_id, head_sha);
CREATE INDEX IF NOT EXISTS gh_pull_requests_closing_issues_idx
  ON gh_pull_requests USING gin(closing_issues);
