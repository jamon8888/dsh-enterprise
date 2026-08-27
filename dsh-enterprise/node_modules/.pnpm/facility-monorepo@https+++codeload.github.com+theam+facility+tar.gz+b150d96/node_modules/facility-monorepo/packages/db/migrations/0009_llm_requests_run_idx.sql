-- Run finalization (gatewayAggregate) and the run receipt sum llm_requests by
-- run_id; without a run_id-leading index that degrades to a scan as metering
-- history grows.
CREATE INDEX IF NOT EXISTS llm_requests_run_idx
  ON llm_requests (run_id);
