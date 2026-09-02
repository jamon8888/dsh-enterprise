"use client";

import { Button, StatusDot } from "@facility/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Markdown } from "@/components/markdown";
import { type AskToolChip, useAskStream } from "./use-ask-stream";

type ThreadMessage = { id: string; role: string; body: string };

function ToolChip({ chip, projectId }: { chip: AskToolChip; projectId: string }) {
  const label = chip.tool.replaceAll("_", " ");
  const tone = chip.ok === undefined ? "agent" : chip.ok ? "ok" : "bad";
  return (
    <span className="inline-flex items-center gap-1.5 border border-(--line) px-2 py-0.5 font-mono text-[10.5px] text-(--mut)">
      <StatusDot tone={tone} pulse={chip.ok === undefined} />
      {label}
      {chip.artifactId ? <span className="text-(--ink)">{chip.artifactId}</span> : null}
      {chip.runId ? (
        <Link
          href={`/projects/${projectId}/sessions/${chip.runId}`}
          className="text-(--info,--mut) underline-offset-2 hover:underline"
        >
          run ↗
        </Link>
      ) : null}
    </span>
  );
}

/**
 * The open thread: prior messages + the live turn (status, tool chips,
 * streaming markdown). Renders above the bar as a slide-up sheet.
 */
export function AskPanel({
  projectId,
  conversationId,
  activeRunId,
  pendingQuestion,
  onClose,
  onNewThread,
}: {
  projectId: string;
  conversationId: string | null;
  activeRunId: string | null;
  /** The just-sent user message, echoed while the turn streams. */
  pendingQuestion: string | null;
  onClose: () => void;
  onNewThread: () => void;
}) {
  const turn = useAskStream(activeRunId);
  const [history, setHistory] = useState<ThreadMessage[]>([]);

  // turn.final is the intended refetch trigger, not a value the body reads —
  // when the turn completes, the durable reply replaces the streamed one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: turn.final is the intended change-trigger.
  useEffect(() => {
    if (!conversationId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/conversations/${conversationId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const detail = (await response.json()) as { messages?: ThreadMessage[] };
        if (!cancelled) setHistory(detail.messages ?? []);
      } catch {
        // Thread history is best-effort; the live turn still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Refetch when the turn completes so the durable reply replaces the stream.
  }, [conversationId, turn.final]);

  async function stop() {
    if (!activeRunId) return;
    await fetch(`/api/v1/runs/${activeRunId}/cancel`, { method: "POST" }).catch(() => undefined);
  }

  // While streaming, the just-sent user message and the live reply aren't in
  // the durable history yet — but the user message persists immediately, so
  // the history refetch can race the echo. Suppress the echo the moment the
  // durable copy is present.
  const lastUserBody = [...history]
    .reverse()
    .find((message) => message.role === "user")
    ?.body?.trim();
  const liveEcho = pendingQuestion && !turn.final && lastUserBody !== pendingQuestion.trim();

  // Same resting accent stroke as the composer below it — the thread and its
  // input are one agent surface, not a gray panel above a yellow bar.
  return (
    <div className="flex max-h-[60vh] flex-col border-2 border-(--accent-soft) bg-(--bg) shadow-(--shadow-lift)">
      <div className="flex items-center justify-between border-b border-(--line) px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--dim)">
          product owner
        </span>
        <div className="flex items-center gap-2">
          {activeRunId && !turn.final ? (
            <Button size="sm" variant="outline" onClick={() => void stop()}>
              stop
            </Button>
          ) : null}
          {conversationId ? (
            <Button size="sm" variant="outline" onClick={onNewThread} title="start a fresh thread">
              new thread
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={onClose}>
            close
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
        {history.length === 0 && !liveEcho && !turn.text ? (
          <p className="text-[12.5px] leading-relaxed text-(--dim)">
            Ask anything about this project — goals, decisions, what's in flight. Paste a meeting
            transcript to file it and review the backlog against it.
          </p>
        ) : null}
        {history.map((message) => (
          <div key={message.id} className={message.role === "user" ? "self-end" : "self-start"}>
            {message.role === "user" ? (
              <p className="max-w-[46ch] border border-(--line) bg-(--card) px-3 py-2 text-[13px] leading-relaxed text-(--ink)">
                {message.body}
              </p>
            ) : (
              <div className="max-w-none text-[13px]">
                <Markdown source={message.body} />
              </div>
            )}
          </div>
        ))}
        {liveEcho ? (
          <div className="self-end">
            <p className="max-w-[46ch] border border-(--line) bg-(--card) px-3 py-2 text-[13px] leading-relaxed text-(--ink)">
              {pendingQuestion}
            </p>
          </div>
        ) : null}
        {activeRunId && !turn.final ? (
          <div className="flex flex-col gap-2 self-start">
            {turn.tools.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {turn.tools.map((chip) => (
                  <ToolChip key={chip.id} chip={chip} projectId={projectId} />
                ))}
              </div>
            ) : null}
            {/* The user must always see the question was received — before the
                first event lands, "thinking" holds the line. */}
            {turn.status || !turn.text ? (
              <p className="flex items-center gap-2 font-mono text-[11px] text-(--dim)">
                <StatusDot tone="agent" pulse />
                {turn.status ?? "thinking…"}
              </p>
            ) : null}
            {turn.text ? (
              <div className="max-w-none text-[13px]">
                <Markdown source={turn.text} />
              </div>
            ) : null}
          </div>
        ) : null}
        {turn.error ? (
          <p className="flex items-center gap-2 self-start font-mono text-[11.5px] text-(--bad,--mut)">
            <StatusDot tone="bad" />
            {turn.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
