ALTER TABLE preview_sandboxes
  DROP CONSTRAINT IF EXISTS preview_sandboxes_driver_check;

ALTER TABLE preview_sandboxes
  ADD CONSTRAINT preview_sandboxes_driver_check
  CHECK (driver IN ('docker', 'aws', 'vercel'));
