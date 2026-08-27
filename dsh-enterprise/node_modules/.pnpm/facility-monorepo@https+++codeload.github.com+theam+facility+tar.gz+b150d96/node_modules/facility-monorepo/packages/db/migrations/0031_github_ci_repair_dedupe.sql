CREATE UNIQUE INDEX IF NOT EXISTS runs_ci_doctor_branch_head_sha_uidx
  ON runs (
    org_id,
    project_id,
    (gh->>'owner'),
    (gh->>'repo'),
    (gh->>'branch'),
    (trigger #>> '{pullRequest,headSha}')
  )
  WHERE mode IN ('ci_doctor', 'ci-doctor')
    AND trigger->>'event' = 'workflow_run'
    AND trigger #>> '{pullRequest,headSha}' IS NOT NULL;
