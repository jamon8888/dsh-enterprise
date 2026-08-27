"use client";

import { useEffect, useState } from "react";

export type AskToolChip = {
  /** Stable append-order id — chips are append-only, never reordered. */
  id: number;
  tool: string;
  ok?: boolean;
  ms?: number;
  /** consult_architect / intake_capture surface the dispatched run. */
  runId?: string;
  artifactId?: string;
};

export type AskTurnState = {
  status: string | null;
  tools: AskToolChip[];
  text: string;
  final: boolean;
  error: string | null;
};

const INITIAL: AskTurnState = { status: null, tools: [], text: "", final: false, error: null };

type RunEvent = { seq?: number; type?: string; data?: Record<string, unknown> };

/** Pure reducer shared by the SSE and polling paths. */
function applyEvent(prev: AskTurnState, event: RunEvent): AskTurnState {
  const data = event.data ?? {};
  switch (event.type) {
    case "status":
      return { ...prev, status: typeof data.message === "string" ? data.message : null };
    case "assistant_delta":
      return {
        ...prev,
        status: null,
        text: prev.text + (typeof data.text === "string" ? data.text : ""),
      };
    case "tool_call":
      return {
        ...prev,
        status: null,
        tools: [...prev.tools, { id: prev.tools.length, tool: String(data.tool ?? "tool") }],
      };
    case "tool_result": {
      const tools = [...prev.tools];
      for (let i = tools.length - 1; i >= 0; i--) {
        const chip = tools[i];
        if (chip && chip.tool === data.tool && chip.ok === undefined) {
          tools[i] = {
            ...chip,
            ok: data.ok !== false,
            ms: typeof data.ms === "number" ? data.ms : undefined,
            runId: typeof data.runId === "string" ? data.runId : undefined,
            artifactId: typeof data.artifactId === "string" ? data.artifactId : undefined,
          };
          break;
        }
      }
      return { ...prev, tools };
    }
    case "assistant":
      return { ...prev, text: typeof data.text === "string" ? data.text : prev.text };
    case "result":
      return {
        ...prev,
        final: true,
        status: null,
        error:
          data.status === "succeeded"
            ? null
            : typeof data.error === "string"
              ? data.error
              : "turn failed",
      };
    default:
      return prev;
  }
}

/** SSE must deliver within this window or the hook falls back to polling. */
const SSE_GRACE_MS = 2_500;
const POLL_INTERVAL_MS = 1_200;

/**
 * Consumer of the run-events channel for one assistant turn. SSE first
 * (instant via pg_notify); if nothing arrives within the grace window it
 * falls back to polling the durable /events endpoint — the turn renders
 * regardless of how the streaming transport behaves in a given browser.
 */
export function useAskStream(runId: string | null): AskTurnState {
  const [state, setState] = useState<AskTurnState>(INITIAL);

  useEffect(() => {
    if (!runId) {
      setState(INITIAL);
      return;
    }
    setState(INITIAL);
    let cursor = 0;
    let sawEvent = false;
    let finished = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const ingest = (events: RunEvent[]) => {
      for (const event of events) {
        if (typeof event.seq === "number") {
          if (event.seq <= cursor) continue;
          cursor = event.seq;
        }
        sawEvent = true;
        if (event.type === "result") finished = true;
        setState((prev) => applyEvent(prev, event));
      }
      if (finished && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const source = new EventSource(`/api/v1/runs/${runId}/stream?afterSeq=0`);
    source.addEventListener("run_event", (message) => {
      try {
        ingest([JSON.parse((message as MessageEvent).data) as RunEvent]);
      } catch {
        // Malformed frame — the durable poller will recover it.
      }
    });
    source.onerror = () => {
      // The endpoint resumes via afterSeq; EventSource reconnects on its own,
      // and the polling fallback below covers transports that never connect.
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/runs/${runId}/events?afterSeq=${cursor}&limit=200`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        ingest(((await response.json()) as RunEvent[]) ?? []);
      } catch {
        // Transient — next tick retries.
      }
    };

    const grace = setTimeout(() => {
      if (sawEvent || finished) return;
      void poll();
      pollTimer = setInterval(() => {
        if (finished) return;
        void poll();
      }, POLL_INTERVAL_MS);
    }, SSE_GRACE_MS);

    return () => {
      clearTimeout(grace);
      if (pollTimer) clearInterval(pollTimer);
      source.close();
    };
  }, [runId]);

  return state;
}
