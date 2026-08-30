-- Migration 001: Initial schema for PostgreSQL session persistence
-- This migration creates all tables, indexes, and triggers needed

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cwd TEXT NOT NULL,
    parent_session UUID REFERENCES sessions(id),
    seed_length INTEGER NOT NULL DEFAULT 0,
    delegation_depth INTEGER NOT NULL DEFAULT 0,
    origin TEXT NOT NULL DEFAULT 'user',
    agent_preset TEXT,
    revision BIGINT NOT NULL DEFAULT 0  -- xmin or logical decoding LSN
);

-- Index for listSnapshots with revision ordering
CREATE INDEX idx_sessions_revision ON sessions(revision DESC);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_parent ON sessions(parent_session);

-- Session events table (append-only event log)
CREATE TABLE session_events (
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq BIGINT NOT NULL,
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    surface_op JSONB,
    source_event_seqs BIGINT[],
    ignorable BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (session_id, seq)
);

-- Indexes for event queries
CREATE INDEX idx_session_events_session_time ON session_events(session_id, time);
CREATE INDEX idx_session_events_type ON session_events(session_id, type);

-- Function to notify on event insert (for LISTEN/NOTIFY)
CREATE OR REPLACE FUNCTION notify_session_event()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'session_events',
        json_build_object(
            'session_id', NEW.session_id,
            'seq', NEW.seq,
            'type', NEW.type,
            'time', NEW.time
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for real-time event broadcast
CREATE TRIGGER trigger_notify_session_event
    AFTER INSERT ON session_events
    FOR EACH ROW
    EXECUTE FUNCTION notify_session_event();

-- Migration tracking table
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO schema_migrations (version, name) VALUES (1, 'initial');