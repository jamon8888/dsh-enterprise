CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  workos_user_id text UNIQUE,
  email text NOT NULL UNIQUE,
  name text,
  avatar_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orgs (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id text PRIMARY KEY,
  org_id text REFERENCES orgs(id),
  name text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS roles_org_name_uidx ON roles (coalesce(org_id, '__bundled__'), name);

CREATE TABLE IF NOT EXISTS org_members (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  user_id text NOT NULL REFERENCES users(id),
  role_id text NOT NULL REFERENCES roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS org_members_org_idx ON org_members (org_id);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  system_version text NOT NULL DEFAULT 'v1',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);
CREATE INDEX IF NOT EXISTS projects_org_idx ON projects (org_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  name text NOT NULL,
  prefix text NOT NULL,
  last4 text NOT NULL,
  hash text NOT NULL,
  scope_type text NOT NULL,
  project_id text REFERENCES projects(id),
  role_id text NOT NULL REFERENCES roles(id),
  created_by text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys (org_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (prefix);

CREATE TABLE IF NOT EXISTS github_installations (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  installation_id bigint NOT NULL UNIQUE,
  account_login text NOT NULL,
  target_type text NOT NULL,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  installation_id text REFERENCES github_installations(id),
  owner text NOT NULL,
  name text NOT NULL,
  default_branch text NOT NULL,
  fingerprint_status text NOT NULL DEFAULT 'unknown',
  fingerprint jsonb,
  fingerprint_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner, name)
);
CREATE INDEX IF NOT EXISTS repos_org_project_idx ON repos (org_id, project_id);

CREATE TABLE IF NOT EXISTS registry_items (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  scope text NOT NULL,
  project_id text REFERENCES projects(id),
  kind text NOT NULL,
  name text NOT NULL,
  description text,
  latest_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS registry_items_scope_uidx ON registry_items (org_id, coalesce(project_id, '__none__'), kind, name);
CREATE INDEX IF NOT EXISTS registry_items_org_idx ON registry_items (org_id);

CREATE TABLE IF NOT EXISTS registry_versions (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  item_id text NOT NULL REFERENCES registry_items(id),
  version integer NOT NULL,
  content text NOT NULL,
  content_hash text NOT NULL,
  changelog text,
  status text NOT NULL DEFAULT 'draft',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version)
);
CREATE INDEX IF NOT EXISTS registry_versions_org_idx ON registry_versions (org_id);

CREATE TABLE IF NOT EXISTS bundles (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  name text NOT NULL,
  description text,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bundle_items (
  org_id text NOT NULL REFERENCES orgs(id),
  bundle_id text NOT NULL REFERENCES bundles(id),
  item_id text NOT NULL REFERENCES registry_items(id),
  version_pin integer,
  PRIMARY KEY (bundle_id, item_id)
);
CREATE INDEX IF NOT EXISTS bundle_items_org_idx ON bundle_items (org_id);

CREATE TABLE IF NOT EXISTS sandbox_profiles (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text REFERENCES projects(id),
  name text NOT NULL,
  driver text NOT NULL,
  image text NOT NULL,
  setup jsonb NOT NULL DEFAULT '{}'::jsonb,
  resources jsonb NOT NULL DEFAULT '{}'::jsonb,
  network jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sandbox_profiles_org_idx ON sandbox_profiles (org_id);

CREATE TABLE IF NOT EXISTS agent_defs (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  name text NOT NULL,
  engine text NOT NULL,
  model jsonb NOT NULL,
  contract_item_id text NOT NULL REFERENCES registry_items(id),
  harness_item_id text REFERENCES registry_items(id),
  triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  sandbox_profile_id text REFERENCES sandbox_profiles(id),
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_defs_org_project_idx ON agent_defs (org_id, project_id);

CREATE TABLE IF NOT EXISTS runs (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  agent_def_id text REFERENCES agent_defs(id),
  mode text NOT NULL,
  engine text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  sandbox jsonb NOT NULL DEFAULT '{}'::jsonb,
  receipt jsonb,
  gh jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  created_by jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_org_project_idx ON runs (org_id, project_id);

CREATE TABLE IF NOT EXISTS run_events (
  org_id text NOT NULL REFERENCES orgs(id),
  run_id text NOT NULL REFERENCES runs(id),
  seq bigint NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (run_id, seq)
);
CREATE INDEX IF NOT EXISTS run_events_org_idx ON run_events (org_id);
CREATE INDEX IF NOT EXISTS run_events_run_seq_idx ON run_events (run_id, seq);

CREATE TABLE IF NOT EXISTS steer_messages (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  run_id text NOT NULL REFERENCES runs(id),
  author_user_id text REFERENCES users(id),
  body text NOT NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS steer_messages_org_idx ON steer_messages (org_id);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  provider text NOT NULL,
  name text NOT NULL,
  base_url text,
  sealed_secret text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider, name)
);

CREATE TABLE IF NOT EXISTS virtual_keys (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  run_id text REFERENCES runs(id),
  name text NOT NULL,
  prefix text NOT NULL,
  last4 text NOT NULL,
  hash text NOT NULL,
  allowed_models text[],
  budget_id text,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS virtual_keys_org_project_idx ON virtual_keys (org_id, project_id);

CREATE TABLE IF NOT EXISTS llm_requests (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  run_id text REFERENCES runs(id),
  virtual_key_id text REFERENCES virtual_keys(id),
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read integer NOT NULL DEFAULT 0,
  cache_write integer NOT NULL DEFAULT 0,
  cost_cents integer,
  latency_ms integer NOT NULL DEFAULT 0,
  request_uri text,
  response_uri text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS llm_requests_org_project_created_idx ON llm_requests (org_id, project_id, created_at);

CREATE TABLE IF NOT EXISTS budgets (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  scope text NOT NULL,
  project_id text REFERENCES projects(id),
  agent_def_id text REFERENCES agent_defs(id),
  period text NOT NULL,
  limit_cents integer NOT NULL,
  mode text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budgets_org_idx ON budgets (org_id);

CREATE TABLE IF NOT EXISTS spend_counters (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  budget_id text NOT NULL REFERENCES budgets(id),
  window_start date NOT NULL,
  spent_cents bigint NOT NULL DEFAULT 0,
  UNIQUE (budget_id, window_start)
);

CREATE TABLE IF NOT EXISTS action_types (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  name text NOT NULL,
  payload_schema jsonb NOT NULL,
  resolver jsonb NOT NULL,
  executor jsonb NOT NULL,
  default_ttl_hours integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS proposals (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text REFERENCES projects(id),
  run_id text REFERENCES runs(id),
  action_type_id text NOT NULL REFERENCES action_types(id),
  payload jsonb NOT NULL,
  context_md text NOT NULL,
  state text NOT NULL DEFAULT 'open',
  decided_by text,
  decided_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposals_org_idx ON proposals (org_id);

CREATE TABLE IF NOT EXISTS proposal_events (
  org_id text NOT NULL REFERENCES orgs(id),
  proposal_id text NOT NULL REFERENCES proposals(id),
  seq bigint NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  actor jsonb NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (proposal_id, seq)
);
CREATE INDEX IF NOT EXISTS proposal_events_org_idx ON proposal_events (org_id);

CREATE TABLE IF NOT EXISTS kb_spaces (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL UNIQUE REFERENCES projects(id),
  charter_md text NOT NULL DEFAULT '',
  active_md text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kb_spaces_org_idx ON kb_spaces (org_id);

CREATE TABLE IF NOT EXISTS kb_entries (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  space_id text NOT NULL REFERENCES kb_spaces(id),
  type text NOT NULL,
  number integer NOT NULL,
  slug text NOT NULL,
  frontmatter jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_md text NOT NULL,
  status text,
  supersedes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, type, number)
);
CREATE INDEX IF NOT EXISTS kb_entries_org_idx ON kb_entries (org_id);

CREATE TABLE IF NOT EXISTS kb_links (
  org_id text NOT NULL REFERENCES orgs(id),
  space_id text NOT NULL REFERENCES kb_spaces(id),
  from_entry text NOT NULL REFERENCES kb_entries(id),
  to_entry text NOT NULL REFERENCES kb_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, from_entry, to_entry)
);
CREATE INDEX IF NOT EXISTS kb_links_org_idx ON kb_links (org_id);

CREATE TABLE IF NOT EXISTS po_tasks (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  kb_entry_id text REFERENCES kb_entries(id),
  title text NOT NULL,
  body_md text NOT NULL,
  wsjf jsonb NOT NULL DEFAULT '{}'::jsonb,
  gh jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS po_tasks_org_project_idx ON po_tasks (org_id, project_id);

CREATE TABLE IF NOT EXISTS platform_issues (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text REFERENCES projects(id),
  kind text NOT NULL,
  severity text NOT NULL,
  fingerprint text NOT NULL,
  title text NOT NULL,
  body_md text NOT NULL,
  state text NOT NULL DEFAULT 'open',
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  seq bigserial NOT NULL,
  actor jsonb NOT NULL,
  action text NOT NULL,
  target jsonb NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  prev_hash text,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, seq)
);
CREATE INDEX IF NOT EXISTS audit_events_org_seq_idx ON audit_events (org_id, seq);

CREATE TABLE IF NOT EXISTS outcomes (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text NOT NULL REFERENCES projects(id),
  repo text NOT NULL,
  pr_number integer NOT NULL,
  agent_lane text NOT NULL,
  opened_at timestamptz NOT NULL,
  terminal_at timestamptz,
  fate text,
  review_rounds integer NOT NULL DEFAULT 0,
  fixup_commits integer NOT NULL DEFAULT 0,
  hours_to_terminal numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, repo, pr_number)
);

CREATE TABLE IF NOT EXISTS integrations (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  project_id text REFERENCES projects(id),
  kind text NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sealed_secret text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integrations_org_idx ON integrations (org_id);

CREATE TABLE IF NOT EXISTS inbound_events (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES orgs(id),
  integration_id text NOT NULL REFERENCES integrations(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  verified boolean NOT NULL DEFAULT false,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error text
);
CREATE INDEX IF NOT EXISTS inbound_events_org_idx ON inbound_events (org_id);
