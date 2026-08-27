import { describe, expect, it } from "vitest";
import {
  pullRequestBodyForIssue,
  pullRequestBodyWithoutFacilityClosingIssue,
} from "../src/github/closing-issues.js";

describe("pull-request closing issue bodies", () => {
  it("prepends the exact GitHub closing line Facility owns", () => {
    expect(pullRequestBodyForIssue("Implementation details", 17, "octo", "repo")).toBe(
      "Closes #17\n\nImplementation details",
    );
    expect(pullRequestBodyForIssue("", 17, "octo", "repo")).toBe("Closes #17");
  });

  it.each([
    "Fixes #17\n\nDetails",
    "Resolved octo/repo#17",
    "Closes: https://github.com/octo/repo/issues/17",
  ])("does not duplicate a supported GitHub closing form: %s", (body) => {
    expect(pullRequestBodyForIssue(body, 17, "octo", "repo")).toBe(body);
  });

  it("ignores apparent references in code", () => {
    const body = "Example:\n```md\nCloses #17\n```\nAnd `Fixes #17`.";
    expect(pullRequestBodyForIssue(body, 17, "octo", "repo")).toBe(`Closes #17\n\n${body}`);
  });

  it("reverses the exact line without rewriting the remaining body", () => {
    expect(
      pullRequestBodyWithoutFacilityClosingIssue("Closes #17\n\nImplementation details", 17),
    ).toBe("Implementation details");
    expect(pullRequestBodyWithoutFacilityClosingIssue("Intro\n\nCloses #17\n\nDetails", 17)).toBe(
      "Intro\n\nDetails",
    );
    expect(pullRequestBodyWithoutFacilityClosingIssue("Closes #17", 17)).toBe("");
  });

  it("refuses to guess how to rewrite human-authored closing syntax", () => {
    expect(pullRequestBodyWithoutFacilityClosingIssue("Fixes #17\n\nDetails", 17)).toBeNull();
    expect(pullRequestBodyWithoutFacilityClosingIssue("Closes #18\n\nDetails", 17)).toBeNull();
  });
});
