"use client";

import { StatusDot } from "@facility/ui";
import { useEffect, useRef, useState } from "react";
import { useAskStream } from "@/components/ask/use-ask-stream";
import { Markdown } from "@/components/markdown";

type ThreadMessage = { id: string; role: string; body: string };

/**
 * A thread's durable history plus the live turn (status, streaming markdown).
 * Display-only: the composer lives with the host (floating panel or the
 * Sessions workspace).
 */
export function ThreadMessages({
  conversationId,
  activeRunId,
  pending,
  emptyHint,
  onFinal,
}: {
  conversationId: string | null;
  activeRunId: string | null;
  /** The just-sent user message, echoed while the turn streams. */
  pending: string | null;
  emptyHint?: string;
  /** Fires once when the live turn completes (titles land server-side). */
  onFinal?: () => void;
}) {
  const turn = useAskStream(activeRunId);
  const finalNotified = useRef(false);
  useEffect(() => {
    if (turn.final && !finalNotified.current) {
      finalNotified.current = true;
      onFinal?.();
    }
    if (!turn.final) finalNotified.current = false;
  }, [turn.final, onFinal]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  // turn.final is the refetch trigger: the durable reply replaces the stream.
  // biome-ignore lint/correctness/useExhaustiveDependencies: turn.final is the intended change-trigger.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
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
        if (!cancelled) setMessages(detail.messages ?? []);
      } catch {
        // Best-effort; the live turn still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, turn.final]);

  const lastUserBody = [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.body?.trim();
  const liveEcho = pending && !turn.final && lastUserBody !== pending.trim();

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && !liveEcho && !turn.text ? (
        <p className="text-[12.5px] leading-relaxed text-(--dim)">
          {emptyHint ??
            "Ask anything about this project — goals, decisions, what's in flight. Paste a meeting transcript to file it and review the backlog against it."}
        </p>
      ) : null}
      {messages.map((message) => (
        <div key={message.id} className={message.role === "user" ? "self-end" : "self-start"}>
          {message.role === "user" ? (
            <p className="max-w-[52ch] border border-(--line) bg-(--card) px-3 py-2 text-[13px] leading-relaxed text-(--ink)">
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
          <p className="max-w-[52ch] border border-(--line) bg-(--card) px-3 py-2 text-[13px] leading-relaxed text-(--ink)">
            {pending}
          </p>
        </div>
      ) : null}
      {activeRunId && !turn.final ? (
        <div className="flex flex-col gap-2 self-start">
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
  );
}
