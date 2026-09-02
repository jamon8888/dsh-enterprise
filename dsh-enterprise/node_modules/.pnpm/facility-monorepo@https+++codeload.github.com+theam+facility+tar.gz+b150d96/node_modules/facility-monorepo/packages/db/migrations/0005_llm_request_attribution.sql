ALTER TABLE llm_requests ADD COLUMN IF NOT EXISTS task_id text REFERENCES po_tasks(id);
ALTER TABLE llm_requests ADD COLUMN IF NOT EXISTS agent_def_id text REFERENCES agent_defs(id);
ALTER TABLE llm_requests ADD COLUMN IF NOT EXISTS priced boolean NOT NULL DEFAULT true;

UPDATE llm_requests SET priced = false WHERE cost_cents IS NULL;

CREATE INDEX IF NOT EXISTS llm_requests_org_created_group_idx
  ON llm_requests (org_id, created_at, agent_def_id, task_id, model);
