"use client";

import { Button, Eyebrow } from "@facility/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Markdown } from "@/components/markdown";
import type { Issue } from "@/lib/api";

const SEVERITY_TONE: Record<string, string> = {
  critical: "text-(--bad)",
  error: "text-(--bad)",
  warn: "text-(--human)",
  info: "text-(--mut)",
};

/**
 * A watchtower alert in card form. Issues are visibility, not approval gates —
 * an operator acknowledges (I see it) or resolves (it's handled). Both hit the
 * audited /v1/issues transition endpoints.
 */
export function IssueCard({ issue }: { issue: Issue }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"ack" | "resolve" | null>(null);
  // Resolve is terminal, so it arms on the first click and dispatches on the
  // second — a stray tap cannot silently close an unresolved issue.
  const [confirmingResolve, setConfirmingResolve] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "ack" | "resolve") {
    setBusy(action);
    setConfirmingResolve(false);
    setError(null);
    try {
      const res = await fetch(`/api/v1/issues/${issue.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? `${action} failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  const severityTone = SEVERITY_TONE[issue.severity] ?? "text-(--mut)";

  return (
    <article className="flex flex-col gap-4 border border-(--line) bg-(--bg) p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow className={severityTone}>
          {issue.severity} · {issue.kind}
        </Eyebrow>
        <span className="font-mono text-[10px] text-(--dim)">
          {issue.count > 1 ? `×${issue.count} · ` : null}
          {issue.state === "acked" ? "acknowledged · " : null}
          last seen {new Date(issue.lastSeen).toLocaleString()}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-(--ink)">{issue.title}</h3>
        <Markdown source={issue.bodyMd} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {issue.state === "open" ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("ack")}>
            {busy === "ack" ? "acknowledging…" : "acknowledge"}
          </Button>
        ) : null}
        {confirmingResolve ? (
          <>
            <Button
              size="sm"
              variant="primary"
              disabled={busy !== null}
              onClick={() => act("resolve")}
            >
              {busy === "resolve" ? "resolving…" : "confirm resolve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setConfirmingResolve(false)}
            >
              cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="primary"
            disabled={busy !== null}
            onClick={() => setConfirmingResolve(true)}
          >
            resolve
          </Button>
        )}
      </div>
      {error ? <p className="font-mono text-[11px] text-(--bad)">{error}</p> : null}
    </article>
  );
}
