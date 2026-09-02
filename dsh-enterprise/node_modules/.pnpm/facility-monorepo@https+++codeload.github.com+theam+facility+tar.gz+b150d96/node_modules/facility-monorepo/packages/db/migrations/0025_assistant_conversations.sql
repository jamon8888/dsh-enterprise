-- Assistant conversations: threads answered by the in-process Product Owner
-- loop (no sandbox container per turn). Existing rows are sandbox threads.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'sandbox';

ALTER TABLE conversations
  ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('sandbox', 'assistant'));
