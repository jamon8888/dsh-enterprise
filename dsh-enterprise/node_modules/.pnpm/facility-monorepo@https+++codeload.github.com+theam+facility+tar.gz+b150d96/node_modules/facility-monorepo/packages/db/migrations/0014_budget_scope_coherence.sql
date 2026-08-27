-- Semantic budget-scope coherence: value CHECKs (0013) alone let a row look
-- "configured" while the gateway silently ignores it (e.g. scope='agent_def' with
-- no agent_def_id) or enforces it too broadly (scope='org' with a project_id the
-- gateway ignores). The API's resolveBudgetScope normalizes every write path, and
-- this constraint is the DB-level backstop so an incoherent budget row can never
-- be persisted by any caller:
--   org        → no project, no agent
--   project    → a project, no agent
--   agent_def  → a project AND an agent
ALTER TABLE budgets ADD CONSTRAINT budgets_scope_coherence_check CHECK (
  (scope = 'org' AND project_id IS NULL AND agent_def_id IS NULL)
  OR (scope = 'project' AND project_id IS NOT NULL AND agent_def_id IS NULL)
  OR (scope = 'agent_def' AND project_id IS NOT NULL AND agent_def_id IS NOT NULL)
);
