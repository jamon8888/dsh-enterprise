import { describe, expect, it } from "vitest";
import { resolveBudgetScope } from "../src/budget-scope.js";

describe("resolveBudgetScope — the single budget-scope source of truth", () => {
  it("nulls project/agent for an org budget", () => {
    expect(
      resolveBudgetScope({
        scope: "org",
        projectId: "proj_x",
        agentDefId: "agt_x",
        principalProjectId: null,
      }),
    ).toEqual({ scope: "org", projectId: null, agentDefId: null });
  });

  it("keeps the project (and nulls agent) for a project budget", () => {
    expect(
      resolveBudgetScope({ scope: "project", projectId: "proj_x", principalProjectId: null }),
    ).toEqual({ scope: "project", projectId: "proj_x", agentDefId: null });
  });

  it("requires an agent def for an agent budget", () => {
    expect(() =>
      resolveBudgetScope({ scope: "agent_def", projectId: "proj_x", principalProjectId: null }),
    ).toThrow("agentDefId");
    expect(
      resolveBudgetScope({
        scope: "agent_def",
        projectId: "proj_x",
        agentDefId: "agt_x",
        principalProjectId: null,
      }),
    ).toEqual({ scope: "agent_def", projectId: "proj_x", agentDefId: "agt_x" });
  });

  it("requires a project for project/agent budgets", () => {
    expect(() => resolveBudgetScope({ scope: "project", principalProjectId: null })).toThrow(
      "projectId",
    );
  });

  it("forbids a project-scoped principal from creating an org budget", () => {
    expect(() => resolveBudgetScope({ scope: "org", principalProjectId: "proj_owner" })).toThrow(
      "org-wide budget",
    );
  });

  it("pins a project-scoped principal's budget to its own project, ignoring a foreign projectId", () => {
    expect(
      resolveBudgetScope({
        scope: "project",
        projectId: "proj_other",
        principalProjectId: "proj_owner",
      }),
    ).toEqual({ scope: "project", projectId: "proj_owner", agentDefId: null });
  });

  it("rejects an unknown scope", () => {
    expect(() => resolveBudgetScope({ scope: "galaxy", principalProjectId: null })).toThrow(
      "scope must be one of",
    );
  });
});
