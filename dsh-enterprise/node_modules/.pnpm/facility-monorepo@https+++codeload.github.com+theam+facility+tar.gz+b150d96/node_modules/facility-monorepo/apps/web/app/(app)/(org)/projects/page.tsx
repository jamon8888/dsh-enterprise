import { ButtonLink, Cell, Eyebrow, HairlineGrid, PillTag, StatusDot } from "@facility/ui";
import Link from "next/link";
import { ErrorNotice, Offline } from "@/components/offline";
import { PipelineStrip } from "@/components/project/pipeline";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { api, type Issue, type Proposal, summarizeSpend } from "@/lib/api";
import { fetchAllRuns, fmtAgo, fmtCost, type RunWithProject } from "@/lib/runs";
import { ProjectsTabs } from "./tabs";

export const metadata = { title: "projects" };

const LIVE = new Set(["queued", "provisioning", "running"]);
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

/** Human phrasing for the newest decision waiting on a project, with its age. */
function decisionLabel(proposal: Proposal): string {
  const issue = (proposal.payload as { issueNumber?: number } | null)?.issueNumber;
  const where = issue ? ` — issue #${issue}` : "";
  const age = proposal.createdAt ? ` · waiting ${fmtAgo(proposal.createdAt)}` : "";
  switch (proposal.actionType) {
    case "plan_acceptance":
      return `Plan waiting for your approval${where}${age}`;
    default:
      return `${proposal.actionType.replaceAll("_", " ")} waiting on you${where}${age}`;
  }
}

type ProjectPulse = {
  needsYou: number;
  decision: string | null;
  liveModes: string[];
  lastAt: string | null;
  lastFailed: string | null;
};

function pulseFor(
  projectId: string,
  runs: RunWithProject[],
  proposals: Proposal[],
  issues: Issue[],
): ProjectPulse {
  const mine = runs.filter((r) => r.project.id === projectId);
  const liveModes = mine.filter((r) => LIVE.has(r.status)).map((r) => r.mode);
  const blocked = mine.filter((r) => r.status === "awaiting_human");
  const myProposals = proposals.filter((p) => p.projectId === projectId);
  const myIssues = issues.filter((i) => i.projectId === projectId);
  const newest = [...mine].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  const newestTerminal = [...mine]
    .filter((r) => TERMINAL.has(r.status))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  const newestProposal = [...myProposals].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  )[0];
  return {
    needsYou: myProposals.length + myIssues.length + blocked.length,
    decision: newestProposal ? decisionLabel(newestProposal) : null,
    liveModes,
    lastAt: newest?.createdAt ?? null,
    lastFailed: newestTerminal?.status === "failed" ? newestTerminal.mode : null,
  };
}

function PulseLines({ pulse }: { pulse: ProjectPulse }) {
  const lines: React.ReactNode[] = [];
  if (pulse.needsYou > 0) {
    lines.push(
      <span key="needs" className="inline-flex items-center gap-1.5 text-(--human)">
        <StatusDot tone="human" />
        {pulse.decision ?? `${pulse.needsYou} decisions waiting on you`}
      </span>,
    );
  }
  if (pulse.liveModes.length > 0) {
    const label =
      pulse.liveModes.length === 1
        ? `${pulse.liveModes[0]} working now`
        : `${pulse.liveModes.length} agents working now`;
    lines.push(
      <span key="live" className="inline-flex items-center gap-1.5 text-(--mut)">
        <StatusDot tone="agent" pulse />
        {label}
      </span>,
    );
  } else if (pulse.lastFailed && lines.length < 2) {
    lines.push(
      <span key="failed" className="inline-flex items-center gap-1.5 text-(--mut)">
        <StatusDot tone="bad" />
        last {pulse.lastFailed} run failed
      </span>,
    );
  }
  if (lines.length === 0) {
    lines.push(
      <span key="idle" className="inline-flex items-center gap-1.5 text-(--dim)">
        <StatusDot tone="machine" />
        {pulse.lastAt ? `quiet · last activity ${fmtAgo(pulse.lastAt)}` : "no agent runs yet"}
      </span>,
    );
  }
  return <div className="flex flex-col gap-2 text-[12px] font-medium">{lines.slice(0, 2)}</div>;
}

export default async function ProjectsPage() {
  const [{ offline, error: runsError, projects, runs }, spend, inbox] = await Promise.all([
    fetchAllRuns(),
    api.spend("?groupBy=day"),
    api.inboxFull(),
  ]);
  if (offline) return <Offline />;

  // One compact, server-classified pipeline request per project. An aggregate
  // endpoint is the upstream ask if this dashboard ever lists dozens.
  const pipelineByProject = new Map(
    await Promise.all(
      projects.map(async (project) => {
        const res = await api.pipeline(project.id);
        return [project.id, res.ok ? res.data.stages : []] as const;
      }),
    ),
  );

  const proposals = inbox.ok ? inbox.data.proposals : [];
  const inboxIssues = inbox.ok ? inbox.data.issues : [];
  const liveTotal = runs.filter((r) => LIVE.has(r.status)).length;
  const needsYou =
    proposals.length +
    inboxIssues.length +
    runs.filter((r) => r.status === "awaiting_human").length;
  const monthCents = spend.ok ? summarizeSpend(spend.data).totalCents : null;

  return (
    <div className="flex flex-col gap-8">
      <LiveRefresh seconds={30} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>projects</Eyebrow>
          <h1 className="text-[clamp(22px,3vw,32px)] font-semibold tracking-tight">Projects</h1>
          <p className="text-[12.5px] text-(--dim)">
            {runsError
              ? `${projects.length} projects`
              : `${projects.length} projects · ${liveTotal} agents live · ${needsYou} need you`}
            {monthCents != null ? ` · ${fmtCost(monthCents)} mtd` : ""}
          </p>
        </div>
        <ButtonLink href="/projects/new" variant="primary">
          kickstart
        </ButtonLink>
      </div>

      <ProjectsTabs />

      {runsError ? <ErrorNotice message={`Couldn't load sessions — ${runsError}`} /> : null}

      {projects.length === 0 ? (
        <p className="max-w-lg text-sm leading-relaxed text-(--dim)">
          No projects yet. Kickstart connects a GitHub repository and opens a PR with the full
          factory — workflows, guards, skills, the standard.
        </p>
      ) : (
        <HairlineGrid cols="sm:grid-cols-2">
          {projects.map((project) => {
            const pulse = pulseFor(project.id, runs, proposals, inboxIssues);
            const stages = pipelineByProject.get(project.id) ?? [];
            return (
              <Cell key={project.id} interactive className="p-0">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex h-full flex-col gap-4 p-6 sm:p-8"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-semibold tracking-tight text-(--ink)">
                        {project.name}
                      </span>
                      <span className="truncate font-mono text-[11px] text-(--dim)">
                        {project.slug}
                      </span>
                    </span>
                    {project.status === "archived" ? <PillTag>archived</PillTag> : null}
                  </div>
                  <p className="line-clamp-2 flex-1 text-[13px] leading-relaxed text-(--mut)">
                    {project.description ?? "—"}
                  </p>
                  <PulseLines pulse={pulse} />
                  <div className="border-t border-(--line) pt-3">
                    <PipelineStrip stages={stages} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-(--dim)">
                    <span>{pulse.lastAt ? `last activity ${fmtAgo(pulse.lastAt)}` : " "}</span>
                    <span>{project.systemVersion ?? "unpinned"}</span>
                  </div>
                </Link>
              </Cell>
            );
          })}
        </HairlineGrid>
      )}
    </div>
  );
}
