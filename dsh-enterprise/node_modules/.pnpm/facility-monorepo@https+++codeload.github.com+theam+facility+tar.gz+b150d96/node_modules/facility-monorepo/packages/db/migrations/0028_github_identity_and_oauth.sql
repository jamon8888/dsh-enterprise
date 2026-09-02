ALTER TABLE users DROP COLUMN IF EXISTS workos_user_id;

CREATE TABLE IF NOT EXISTS user_identities (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  provider text NOT NULL,
  provider_subject text NOT NULL,
  login text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_identities_provider_subject_uidx UNIQUE (provider, provider_subject),
  CONSTRAINT user_identities_user_provider_uidx UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS user_identities_user_idx ON user_identities(user_id);

ALTER TABLE github_installations ADD COLUMN IF NOT EXISTS account_id bigint;
UPDATE github_installations SET account_id = installation_id WHERE account_id IS NULL;
ALTER TABLE github_installations ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE github_installations ALTER COLUMN account_id SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS oauth_artifacts (
  model text NOT NULL,
  id_hash text NOT NULL,
  payload text NOT NULL,
  grant_id_hash text,
  user_code_hash text,
  uid_hash text,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model, id_hash)
);
CREATE INDEX IF NOT EXISTS oauth_artifacts_grant_idx ON oauth_artifacts(grant_id_hash);
CREATE INDEX IF NOT EXISTS oauth_artifacts_user_code_idx ON oauth_artifacts(user_code_hash);
CREATE INDEX IF NOT EXISTS oauth_artifacts_uid_idx ON oauth_artifacts(uid_hash);
CREATE INDEX IF NOT EXISTS oauth_artifacts_expiry_idx ON oauth_artifacts(expires_at);

ALTER TABLE preview_sandboxes DROP CONSTRAINT IF EXISTS preview_sandboxes_auth_check;
UPDATE preview_sandboxes SET auth_mode = 'facility_session' WHERE auth_mode = 'workos_sso';
ALTER TABLE preview_sandboxes ALTER COLUMN auth_mode SET DEFAULT 'facility_session';
ALTER TABLE preview_sandboxes
  ADD CONSTRAINT preview_sandboxes_auth_check CHECK (auth_mode = 'facility_session');
