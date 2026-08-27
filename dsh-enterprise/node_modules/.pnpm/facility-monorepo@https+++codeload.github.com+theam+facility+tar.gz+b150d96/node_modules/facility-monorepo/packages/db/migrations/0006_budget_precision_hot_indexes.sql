ALTER TABLE llm_requests
  ALTER COLUMN cost_cents TYPE numeric(20, 6) USING cost_cents::numeric(20, 6);

ALTER TABLE spend_counters
  ALTER COLUMN spent_cents TYPE numeric(20, 6) USING spent_cents::numeric(20, 6),
  ALTER COLUMN spent_cents SET DEFAULT 0;

ALTER TABLE analytics_daily
  ALTER COLUMN cost_cents TYPE numeric(20, 6) USING cost_cents::numeric(20, 6),
  ALTER COLUMN cost_cents SET DEFAULT 0;

-- /v1/runs org-wide and project-scoped listing, ordered newest queued first.
CREATE INDEX IF NOT EXISTS runs_org_queued_idx
  ON runs (org_id, queued_at DESC);

CREATE INDEX IF NOT EXISTS runs_org_status_queued_idx
  ON runs (org_id, status, queued_at DESC);

CREATE INDEX IF NOT EXISTS runs_org_project_queued_idx
  ON runs (org_id, project_id, queued_at DESC);

CREATE INDEX IF NOT EXISTS runs_org_project_status_queued_idx
  ON runs (org_id, project_id, status, queued_at DESC);

-- /v1/spend project-scoped time range grouping by agent/task/model.
CREATE INDEX IF NOT EXISTS llm_requests_org_project_created_group_idx
  ON llm_requests (org_id, project_id, created_at, agent_def_id, task_id, model);

-- Registry version reads filter by org+item and order by version.
CREATE INDEX IF NOT EXISTS registry_versions_org_item_version_idx
  ON registry_versions (org_id, item_id, version);

-- System bootstrap reads org sandbox profiles in creation order.
CREATE INDEX IF NOT EXISTS sandbox_profiles_org_created_idx
  ON sandbox_profiles (org_id, created_at);
