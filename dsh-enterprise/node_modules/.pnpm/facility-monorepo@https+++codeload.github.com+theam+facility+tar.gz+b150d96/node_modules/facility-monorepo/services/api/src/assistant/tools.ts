/**
 * The assistant's tool contract: a curated subset of the /v1 surface, executed
 * in-process via app.inject with the ORIGINAL requester's auth headers — the
 * loop acts strictly as the asking user's principal (permissions, project
 * pinning, audit and idempotency all enforced by the real routes; no god key).
 */

export type AssistantToolRequest = {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
};

export type AssistantTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  toRequest: (args: Record<string, unknown>, ctx: { projectId: string }) => AssistantToolRequest;
};

const NO_ARGS = { type: "object", properties: {}, additionalProperties: false } as const;

function str(description: string) {
  return { type: "string", description } as const;
}

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    name: "get_pipeline",
    description:
      "The project's delivery pipeline: repository-qualified stories grouped by durable stage (Backlog → Planning → Building → Validating → In review → Shipped), with an actionable state inside each stage, current runs, mirrored PRs, CI, and human gates. Use this for 'what is in flight / where is X / what needs action'.",
    inputSchema: NO_ARGS,
    toRequest: (_a, ctx) => ({ method: "GET", path: `/v1/projects/${ctx.projectId}/pipeline` }),
  },
  {
    name: "kb_space",
    description:
      "The project's charter and ACTIVE working state (objective, next step, blockers). Read this before answering questions about goals or current focus.",
    inputSchema: NO_ARGS,
    toRequest: (_a, ctx) => ({ method: "GET", path: `/v1/projects/${ctx.projectId}/kb/space` }),
  },
  {
    name: "kb_decisions",
    description:
      "Decision records (ADRs) with their artifact codes (D001…), status and supersedence. activeOnly=false includes superseded history.",
    inputSchema: {
      type: "object",
      properties: { activeOnly: { type: "boolean", description: "default true" } },
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "GET",
      path: `/v1/projects/${ctx.projectId}/kb/decisions`,
      ...(a.activeOnly === false ? {} : { query: { active: "1" } }),
    }),
  },
  {
    name: "kb_search",
    description:
      "Substring search over knowledge-base entries (slug + body). Optional type filter: S signal, D decision, T task, V verification, R reference.",
    inputSchema: {
      type: "object",
      properties: { q: str("search text"), type: str("optional entry type letter") },
      required: ["q"],
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "GET",
      path: `/v1/projects/${ctx.projectId}/kb/search`,
      query: {
        q: String(a.q ?? ""),
        ...(typeof a.type === "string" && a.type ? { type: a.type } : {}),
      },
    }),
  },
  {
    name: "kb_entry",
    description:
      "One knowledge-base entry with its full body and linked neighborhood (supersedes / superseded-by / linked). entryId is the database id returned by kb_search/kb_decisions.",
    inputSchema: {
      type: "object",
      properties: { entryId: str("kb entry id (ent_…)") },
      required: ["entryId"],
      additionalProperties: false,
    },
    toRequest: (a) => ({
      method: "GET",
      path: `/v1/kb/entries/${encodeURIComponent(String(a.entryId ?? ""))}/neighborhood`,
    }),
  },
  {
    name: "list_tasks",
    description: "Product-owner backlog tasks (drafts and proposals) with WSJF and status.",
    inputSchema: NO_ARGS,
    toRequest: (_a, ctx) => ({ method: "GET", path: `/v1/projects/${ctx.projectId}/tasks` }),
  },
  {
    name: "list_issues",
    description: "GitHub issues mirrored for the project. state: open (default) | closed | all.",
    inputSchema: {
      type: "object",
      properties: { state: str("open | closed | all") },
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "GET",
      path: `/v1/projects/${ctx.projectId}/issues`,
      query: { state: typeof a.state === "string" && a.state ? a.state : "open", limit: "100" },
    }),
  },
  {
    name: "get_issue",
    description:
      "One mirrored GitHub issue with body and linked runs. Pass repoId from get_pipeline/list_issues when the project has more than one repository.",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "GitHub issue number" },
        repoId: str(
          "repository id from get_pipeline/list_issues; required when the number is ambiguous",
        ),
      },
      required: ["number"],
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "GET",
      path: `/v1/projects/${ctx.projectId}/issues/${Number(a.number ?? 0)}`,
      ...(typeof a.repoId === "string" && a.repoId ? { query: { repoId: a.repoId } } : {}),
    }),
  },
  {
    name: "project_health",
    description: "Project health signals (workflow failures, canary, fingerprints).",
    inputSchema: NO_ARGS,
    toRequest: (_a, ctx) => ({ method: "GET", path: `/v1/projects/${ctx.projectId}/health` }),
  },
  {
    name: "run_result",
    description:
      "Status and distilled answer of a run (e.g. a previously dispatched architect consult). Returns terminal=false while it is still working.",
    inputSchema: {
      type: "object",
      properties: { runId: str("run id (run_…)") },
      required: ["runId"],
      additionalProperties: false,
    },
    toRequest: (a) => ({
      method: "GET",
      path: `/v1/runs/${encodeURIComponent(String(a.runId ?? ""))}/result`,
    }),
  },
  {
    name: "intake_capture",
    description:
      "File source material the user shared (meeting transcript, notes, request) as a Signal in the knowledge base WITH provenance. It does NOT dispatch anything: YOU are the review — after filing, read the pipeline and active decisions in this same conversation and propose whatever backlog or decision changes the capture implies, citing the signal code.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("short title for the signal"),
        source: str("where this came from, e.g. 'meeting 2026-07-25' or 'pasted by user'"),
        bodyMd: str("the full pasted content, markdown"),
      },
      required: ["title", "source", "bodyMd"],
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "POST",
      path: `/v1/projects/${ctx.projectId}/kb/intake`,
      body: {
        title: String(a.title ?? ""),
        source: String(a.source ?? "assistant"),
        bodyMd: String(a.bodyMd ?? ""),
        dispatch: false,
      },
    }),
  },
  {
    name: "propose_issue_update",
    description:
      "Propose updating an EXISTING GitHub issue's title and body. Full replacement — read the current issue with get_issue first and carry forward everything that should stay. The proposal goes to the human Approvals queue and onto the issue's story timeline; GitHub is updated only after a human approves.",
    inputSchema: {
      type: "object",
      properties: {
        issueNumber: { type: "integer", description: "GitHub issue number to update" },
        repoId: str("repository id from get_issue/get_pipeline; required for multi-repo projects"),
        title: str("the full new title"),
        bodyMd: str("the full new body, markdown — a complete replacement"),
        reason: str("why this update — cited signals/decisions (e.g. S004, D002)"),
      },
      required: ["issueNumber", "title", "bodyMd", "reason"],
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "POST",
      path: "/v1/proposals",
      body: {
        projectId: ctx.projectId,
        actionType: "issue_update",
        payload: {
          issueNumber: Number(a.issueNumber ?? 0),
          ...(typeof a.repoId === "string" && a.repoId ? { repoId: a.repoId } : {}),
          title: String(a.title ?? ""),
          bodyMd: String(a.bodyMd ?? ""),
        },
        contextMd: `Issue update proposal for #${Number(a.issueNumber ?? 0)}: ${String(a.reason ?? "")}`,
      },
    }),
  },
  {
    name: "draft_task",
    description:
      "Draft a backlog task from an idea. Drafts are NOT issues yet — after drafting, use propose_task so a human can approve it into a GitHub issue.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("task title"),
        bodyMd: str("task body: problem, scope, acceptance criteria"),
      },
      required: ["title", "bodyMd"],
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "POST",
      path: `/v1/projects/${ctx.projectId}/tasks`,
      body: { title: String(a.title ?? ""), bodyMd: String(a.bodyMd ?? ""), status: "draft" },
    }),
  },
  {
    name: "propose_task",
    description:
      "Send a drafted task to the human approval queue (HITL proposal). On approval the platform creates the GitHub issue. Never claim the issue exists before approval.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("task id (task_…)") },
      required: ["taskId"],
      additionalProperties: false,
    },
    toRequest: (a) => ({
      method: "POST",
      path: `/v1/tasks/${encodeURIComponent(String(a.taskId ?? ""))}/propose`,
      body: {},
    }),
  },
  {
    name: "consult_architect",
    description:
      "Dispatch a sandboxed read-only architect run to inspect the actual code and answer a technical question. Container runs take MINUTES: give the user an interim answer citing the dispatched run, and check later with run_result. Use only when the answer genuinely requires reading the repository.",
    inputSchema: {
      type: "object",
      properties: { question: str("the code-level question, self-contained (min 8 chars)") },
      required: ["question"],
      additionalProperties: false,
    },
    toRequest: (a, ctx) => ({
      method: "POST",
      path: `/v1/projects/${ctx.projectId}/consult`,
      body: { question: String(a.question ?? "") },
    }),
  },
];
