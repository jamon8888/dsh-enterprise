import { Cell, Eyebrow, HairlineGrid, Metric } from "@facility/ui";
import { ErrorNotice } from "@/components/offline";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { api, summarizeSpend } from "@/lib/api";
import { fmtCost } from "@/lib/runs";
import { ProjectsTabs } from "../tabs";

export const metadata = { title: "stats" };

const DASH = "—";

export default async function ProjectsStatsPage() {
  const [overview, spend] = await Promise.all([api.analyticsOverview(), api.spend("?groupBy=day")]);
  const outcomeTotals = overview.ok ? overview.data.outcomes30d : null;
  const evidenceCoverage =
    outcomeTotals && outcomeTotals.total > 0
      ? Math.round((100 * outcomeTotals.assessed) / outcomeTotals.total)
      : null;
  const monthCents = spend.ok ? summarizeSpend(spend.data).totalCents : null;

  return (
    <div className="flex flex-col gap-8">
      <LiveRefresh seconds={60} />
      <div className="flex flex-col gap-2">
        <Eyebrow>projects</Eyebrow>
        <h1 className="text-[clamp(22px,3vw,32px)] font-semibold tracking-tight">Stats</h1>
        <p className="text-[12.5px] text-(--dim)">
          Delivery outcomes across every project, last 30 days.
        </p>
      </div>

      <ProjectsTabs />

      {!overview.ok ? (
        <ErrorNotice message={`Couldn't load outcomes — ${overview.message}`} />
      ) : null}

      <section className="flex flex-col gap-4">
        <Eyebrow>outcomes · 30 days</Eyebrow>
        <HairlineGrid cols="grid-cols-2 lg:grid-cols-4">
          <Cell>
            <Metric
              label="acceptance"
              value={
                overview.ok && overview.data.acceptance30d != null
                  ? `${overview.data.acceptance30d}%`
                  : DASH
              }
              hint={
                outcomeTotals
                  ? `${outcomeTotals.accepted}/${outcomeTotals.assessed} assessed PRs accepted`
                  : "outcomes didn't load"
              }
            />
          </Cell>
          <Cell>
            <Metric
              label="evidence coverage"
              value={evidenceCoverage == null ? DASH : `${evidenceCoverage}%`}
              hint={
                outcomeTotals
                  ? `${outcomeTotals.assessed}/${outcomeTotals.total} terminal agent PRs assessed`
                  : "outcomes didn't load"
              }
            />
          </Cell>
          <Cell>
            <Metric
              label="one-shot"
              value={
                overview.ok && overview.data.oneShot30d != null
                  ? `${overview.data.oneShot30d}%`
                  : DASH
              }
              hint={
                outcomeTotals
                  ? `${outcomeTotals.oneShot}/${outcomeTotals.merged} merged PRs`
                  : "outcomes didn't load"
              }
            />
          </Cell>
          <Cell>
            <Metric
              label="accepted"
              value={outcomeTotals?.accepted ?? DASH}
              hint={outcomeTotals ? `${outcomeTotals.merged} merged` : "outcomes didn't load"}
            />
          </Cell>
        </HairlineGrid>
      </section>

      <section className="flex flex-col gap-4">
        <Eyebrow>spend · month to date</Eyebrow>
        <HairlineGrid cols="grid-cols-2 lg:grid-cols-4">
          <Cell>
            <Metric
              label="model spend"
              value={monthCents != null ? fmtCost(monthCents) : DASH}
              hint="all projects, all agents"
            />
          </Cell>
        </HairlineGrid>
      </section>
    </div>
  );
}
