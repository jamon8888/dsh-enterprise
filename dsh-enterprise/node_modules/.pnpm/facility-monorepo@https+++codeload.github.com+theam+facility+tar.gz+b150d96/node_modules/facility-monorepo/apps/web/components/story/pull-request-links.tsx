"use client";

import { Button } from "@facility/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PipelinePullRequest } from "@/lib/api";
import type { StoryLinkCandidate } from "@/lib/pull-request-links";

export function PullRequestLinks({
  projectId,
  repoId,
  storyType,
  storyNumber,
  issueCandidates,
  pullCandidates,
  detachablePulls,
}: {
  projectId: string;
  repoId: string;
  storyType: "issue" | "pull_request";
  storyNumber: number;
  issueCandidates: StoryLinkCandidate[];
  pullCandidates: StoryLinkCandidate[];
  detachablePulls: PipelinePullRequest[];
}) {
  const router = useRouter();
  const candidates = storyType === "pull_request" ? issueCandidates : pullCandidates;
  const [selected, setSelected] = useState(candidates[0]?.number ?? 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0 && detachablePulls.length === 0) return null;

  const selectedCandidate = candidates.some((candidate) => candidate.number === selected)
    ? selected
    : (candidates[0]?.number ?? 0);
  const issueNumber = storyType === "pull_request" ? selectedCandidate : storyNumber;
  const pullNumber = storyType === "pull_request" ? storyNumber : selectedCandidate;

  async function attach() {
    if (!issueNumber || !pullNumber) return;
    setBusy("attach");
    setError(null);
    try {
      const response = await fetch(closingIssuesUrl(projectId, repoId, pullNumber), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ issueNumber }),
      });
      await requireSuccess(response, "attach pull request");
      if (storyType === "pull_request") {
        const query = new URLSearchParams({ repoId, storyType: "issue" });
        router.replace(`/projects/${projectId}/stories/${issueNumber}?${query}`);
        return;
      }
      router.refresh();
    } catch (cause) {
      setError(messageOf(cause, "Could not attach the pull request"));
    } finally {
      setBusy(null);
    }
  }

  async function detach(pull: PipelinePullRequest) {
    setBusy(`detach:${pull.number}`);
    setError(null);
    try {
      const response = await fetch(closingIssuesUrl(projectId, repoId, pull.number, storyNumber), {
        method: "DELETE",
      });
      await requireSuccess(response, "detach pull request");
      router.refresh();
    } catch (cause) {
      setError(messageOf(cause, "Could not detach the pull request"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 border border-(--line) bg-(--bg-subtle) px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-(--mut)">GitHub story link</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-(--dim)">
            Facility updates the PR body with a closing keyword, then confirms the link from GitHub.
          </p>
        </div>
        {candidates.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              value={selectedCandidate}
              onChange={(event) => setSelected(Number(event.target.value))}
              disabled={busy !== null}
              aria-label={
                storyType === "pull_request" ? "story to attach" : "pull request to attach"
              }
              className="h-8 max-w-72 border border-(--line) bg-(--bg) px-2 font-mono text-[11px] text-(--mut) outline-none focus:border-(--line-strong)"
            >
              {candidates.map((candidate) => (
                <option key={candidate.number} value={candidate.number}>
                  #{candidate.number} · {candidate.title}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void attach()}
            >
              {busy === "attach"
                ? "attaching…"
                : storyType === "pull_request"
                  ? "attach to story"
                  : "attach PR"}
            </Button>
          </div>
        ) : null}
      </div>

      {detachablePulls.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--line) pt-3">
          {detachablePulls.map((pull) => (
            <span key={pull.number} className="inline-flex items-center gap-2">
              <a
                href={pull.url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-(--mut) underline-offset-4 hover:text-(--ink) hover:underline"
              >
                PR #{pull.number} ↗
              </a>
              <Button
                size="sm"
                variant="textual"
                disabled={busy !== null}
                onClick={() => void detach(pull)}
              >
                {busy === `detach:${pull.number}` ? "detaching…" : "detach"}
              </Button>
            </span>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="font-mono text-[11px] text-(--bad)">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function closingIssuesUrl(
  projectId: string,
  repoId: string,
  pullNumber: number,
  issueNumber?: number,
) {
  const query = new URLSearchParams({ repoId });
  const suffix = issueNumber ? `/${issueNumber}` : "";
  return `/api/v1/projects/${projectId}/pulls/${pullNumber}/closing-issues${suffix}?${query}`;
}

async function requireSuccess(response: Response, action: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(body?.error?.message ?? `${action} failed (${response.status})`);
}

function messageOf(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}
