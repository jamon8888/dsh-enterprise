import { cx, StatusDot } from "@facility/ui";
import Link from "next/link";
import { type PipelineStage, type PipelineStageKind, pipelineStageSummaries } from "@/lib/pipeline";

const KIND_COUNT_TONE: Record<PipelineStageKind, string> = {
  human: "text-(--human)",
  agent: "text-(--ink)",
  machine: "text-(--info)",
  done: "text-(--ink)",
};

function countTone(kind: PipelineStageKind, count: number) {
  return count === 0 ? "text-(--dim)" : KIND_COUNT_TONE[kind];
}

/** Durable lifecycle stages with actionable state queues inside each stage. */
export function PipelineBoard({
  stages,
  projectId,
}: {
  stages: PipelineStage[];
  projectId?: string;
}) {
  return (
    <div className="grid grid-cols-1 border border-(--line) sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stages.map((stage) => {
        const summaries = pipelineStageSummaries(stage);
        const header = (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span
                className={cx(
                  "font-mono text-[20px] font-semibold leading-none",
                  countTone(stage.kind, stage.count),
                )}
              >
                {stage.count}
              </span>
              <span className="text-[12.5px] font-semibold text-(--ink)">{stage.label}</span>
            </div>
            <span className="text-[11px] leading-snug text-(--dim)">{stage.sub}</span>
          </div>
        );
        return (
          <div
            key={stage.key}
            className="-ml-px -mt-px flex min-h-[174px] flex-col gap-4 border-l border-t border-(--line) p-4"
          >
            {projectId ? (
              <Link
                href={`/projects/${projectId}/stories?stage=${stage.key}`}
                className="transition-opacity hover:opacity-80"
              >
                {header}
              </Link>
            ) : (
              header
            )}
            <div className="flex flex-col gap-1">
              {summaries.map((summary) => {
                const row = (
                  <>
                    <StatusDot
                      tone={summary.tone}
                      pulse={summary.state === "in_progress" || summary.state === "checks_running"}
                    />
                    <span className="w-6 text-right font-mono text-[12px] font-semibold text-(--ink)">
                      {summary.count}
                    </span>
                    <span className="text-[11.5px] text-(--mut)">{summary.label}</span>
                    {projectId ? (
                      <span aria-hidden className="ml-auto text-[11px] text-(--dim)">
                        →
                      </span>
                    ) : null}
                  </>
                );
                return projectId ? (
                  <Link
                    key={summary.state}
                    href={`/projects/${projectId}/stories?stage=${stage.key}&status=${summary.state}`}
                    className="flex min-h-8 items-center gap-2 px-1 transition-colors hover:bg-(--card) hover:text-(--ink)"
                    aria-label={`${summary.count} ${summary.label.toLowerCase()} in ${stage.label}`}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={summary.state} className="flex min-h-8 items-center gap-2 px-1">
                    {row}
                  </div>
                );
              })}
              {summaries.length === 0 ? (
                <span className="px-1 py-2 text-[11.5px] text-(--dim)">Nothing here</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One-line pipeline summary for project cards: the same server model, compressed. */
export function PipelineStrip({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[10.5px]">
      {stages.map((stage) => (
        <span key={stage.key} className="inline-flex items-baseline gap-1">
          <span className={countTone(stage.kind, stage.count)}>
            {stage.count === 0 ? "–" : stage.count}
          </span>
          <span className="text-(--dim)">{stage.label.toLowerCase()}</span>
        </span>
      ))}
    </div>
  );
}
