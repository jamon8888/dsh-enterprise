import { describe, expect, it } from "vitest";
import { selectInboundProjectId } from "../src/integrations/inbound.js";

describe("generic inbound project scope", () => {
  it("uses the integration project when the integration is project-scoped", () => {
    expect(selectInboundProjectId("proj_a", {}, {})).toBe("proj_a");
    expect(selectInboundProjectId("proj_a", { projectId: "proj_a" }, {})).toBe("proj_a");
    expect(selectInboundProjectId("proj_a", { signal: { projectId: "proj_a" } }, {})).toBe(
      "proj_a",
    );
  });

  it("rejects every cross-project selector for a project-scoped integration", () => {
    const cases: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [{ projectId: "proj_b" }, {}],
      [{ issue: { projectId: "proj_b" } }, {}],
      [{ signal: { projectId: "proj_b" } }, {}],
      [{}, { projectId: "proj_b" }],
    ];
    for (const [payload, config] of cases) {
      let error: unknown;
      try {
        selectInboundProjectId("proj_a", payload, config);
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toMatchObject({
        statusCode: 400,
        code: "generic_inbound_project_scope_mismatch",
      });
    }
  });

  it("allows an organization-scoped integration to select an organization project", () => {
    expect(selectInboundProjectId(null, { projectId: "proj_a" }, {})).toBe("proj_a");
    expect(selectInboundProjectId(null, {}, { projectId: "proj_b" })).toBe("proj_b");
    expect(selectInboundProjectId(null, {}, {})).toBeNull();
  });
});
