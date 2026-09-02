"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";

type RunResult = { terminal: boolean; answer: string | null; error: string | null };

/**
 * The run's distilled outcome (an architect's plan, a builder's report),
 * fetched lazily the first time the disclosure opens — timelines can carry
 * many runs and most visits only open one or two.
 */
export function RunOutcome({ runId }: { runId: string }) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");

  async function load() {
    if (result || state === "loading") return;
    setState("loading");
    try {
      const response = await fetch(`/api/v1/runs/${runId}/result`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setResult((await response.json()) as RunResult);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <details className="group" onToggle={(event) => event.currentTarget.open && void load()}>
      <summary className="cursor-pointer font-mono text-[10.5px] text-(--dim) hover:text-(--ink)">
        outcome
      </summary>
      <div className="mt-2 border-t border-(--line) pt-3 text-[12.5px]">
        {state === "loading" ? (
          <p className="font-mono text-[11px] text-(--dim)">loading…</p>
        ) : state === "failed" ? (
          <p className="font-mono text-[11px] text-(--bad)">couldn't load the outcome</p>
        ) : result?.answer?.trim() ? (
          <Markdown source={result.answer} />
        ) : result?.error ? (
          <p className="font-mono text-[11px] text-(--bad)">{result.error}</p>
        ) : result ? (
          <p className="font-mono text-[11px] text-(--dim)">no distilled outcome recorded</p>
        ) : null}
      </div>
    </details>
  );
}
