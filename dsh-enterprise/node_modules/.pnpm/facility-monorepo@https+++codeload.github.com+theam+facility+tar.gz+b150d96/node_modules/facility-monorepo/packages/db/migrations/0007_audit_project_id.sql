ALTER TABLE audit_events ADD COLUMN project_id text REFERENCES projects(id);

CREATE INDEX audit_events_org_project_seq_idx ON audit_events (org_id, project_id, seq DESC);
