-- A repo registration is a per-ORG resource. The original global UNIQUE(owner,
-- name) let one tenant reserve or probe another tenant's repo: connect succeeding
-- vs failing on the unique conflict is an existence oracle, and it lets a tenant
-- squat a name another tenant legitimately needs. Scope uniqueness to the org so
-- two orgs can each reference the same GitHub repo and neither can detect the
-- other; within an org a repo is still registered once.
ALTER TABLE repos DROP CONSTRAINT IF EXISTS repos_owner_name_key;
ALTER TABLE repos DROP CONSTRAINT IF EXISTS repos_owner_name_uidx;

ALTER TABLE repos ADD CONSTRAINT repos_org_owner_name_uidx UNIQUE (org_id, owner, name);
