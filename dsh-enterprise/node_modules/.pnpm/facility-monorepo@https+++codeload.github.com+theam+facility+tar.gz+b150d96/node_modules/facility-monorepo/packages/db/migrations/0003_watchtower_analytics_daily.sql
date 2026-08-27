CREATE TABLE IF NOT EXISTS analytics_daily (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  day date NOT NULL,
  agent_def_id text REFERENCES agent_defs(id),
  model text NOT NULL DEFAULT 'none',
  runs_started integer NOT NULL DEFAULT 0,
  runs_succeeded integer NOT NULL DEFAULT 0,
  runs_failed integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cache_read bigint NOT NULL DEFAULT 0,
  cache_write bigint NOT NULL DEFAULT 0,
  cost_cents bigint NOT NULL DEFAULT 0,
  outcomes_total integer NOT NULL DEFAULT 0,
  outcomes_merged integer NOT NULL DEFAULT 0,
  outcomes_one_shot integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_daily_scope_uidx
  ON analytics_daily (org_id, project_id, day, coalesce(agent_def_id, '__none__'), model);
CREATE INDEX IF NOT EXISTS analytics_daily_org_day_idx ON analytics_daily (org_id, day);
