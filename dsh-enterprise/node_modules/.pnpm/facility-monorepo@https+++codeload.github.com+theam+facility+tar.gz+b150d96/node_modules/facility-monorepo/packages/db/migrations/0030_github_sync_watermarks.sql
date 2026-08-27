ALTER TABLE scheduler_watermarks
  ADD COLUMN IF NOT EXISTS cursor text,
  ADD COLUMN IF NOT EXISTS scan_started_at timestamptz;
