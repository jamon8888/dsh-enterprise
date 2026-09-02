import { cx, StatusDot } from "@facility/ui";
import type { ReactNode } from "react";
import type { PipelineStageKind } from "@/lib/pipeline";

const KIND_DOT: Record<
  PipelineStageKind,
  (state: { total: number; liveCount: number }) => ReactNode
> = {
  human: () => <StatusDot tone="human" />,
  agent: ({ total, liveCount }) => (
    <StatusDot tone={total > 0 ? "agent" : "machine"} pulse={liveCount > 0} />
  ),
  machine: () => <StatusDot tone="machine" />,
  done: () => <StatusDot tone="ok" />,
};

/**
 * A collapsible pipeline stage. Native <details> keeps this a server
 * component: no client state, and the collapsed-only summary chips are
 * hidden via `details[open]` CSS alone.
 */
export function StageSection({
  label,
  sub,
  kind,
  total,
  liveCount,
  failedCount,
  defaultOpen,
  children,
}: {
  label: string;
  sub: string;
  kind: PipelineStageKind;
  total: number;
  liveCount: number;
  failedCount: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group flex flex-col gap-3">
      <summary className="flex cursor-pointer list-none items-baseline gap-3 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="font-mono text-[11px] text-(--dim) transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        {failedCount > 0 ? <StatusDot tone="bad" /> : KIND_DOT[kind]({ total, liveCount })}
        <h2 className="text-[14px] font-semibold tracking-tight">{label}</h2>
        <span className="font-mono text-[12px] text-(--dim)">{total}</span>
        <span className="text-[11.5px] text-(--dim)">{sub}</span>
        {/* Collapsed-only state summary: what's inside without opening. */}
        <span className="ml-auto flex items-center gap-3 font-mono text-[11px] group-open:hidden">
          {liveCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-(--mut)">
              <StatusDot tone="agent" pulse />
              {liveCount} running
            </span>
          ) : null}
          {failedCount > 0 ? (
            <span className={cx("inline-flex items-center gap-1.5", "text-(--bad,--mut)")}>
              <StatusDot tone="bad" />
              {failedCount} failed
            </span>
          ) : null}
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
