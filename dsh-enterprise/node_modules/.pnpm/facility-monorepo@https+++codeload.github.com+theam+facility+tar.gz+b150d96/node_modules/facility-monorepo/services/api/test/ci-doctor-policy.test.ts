import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CiDoctorCheck,
  type CiDoctorPullRequest,
  classifyCiDoctorFailure,
  decideCiDoctorAction,
  sanitizeCiFailureSignal,
} from "../src/github/ci-doctor-policy.js";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const vectors = JSON.parse(
  readFileSync(
    new URL("../../../packages/cli/test/fixtures/doctor-policy-conformance.json", import.meta.url),
    "utf8",
  ),
) as Array<{
  name: string;
  eventHeadSha: string;
  headSha: string;
  headRepo: string;
  baseRepo: string;
  changedFiles: string[];
  checks: CiDoctorCheck[];
  expected: { action: string; category?: string };
}>;

function pullRequest(overrides: Partial<CiDoctorPullRequest> = {}): CiDoctorPullRequest {
  return {
    number: 7,
    state: "open",
    draft: true,
    url: "https://github.test/acme/demo/pull/7",
    head: { ref: "feature/repair", sha: SHA_A, repo: { fullName: "acme/demo" } },
    base: { ref: "main", repo: { fullName: "acme/demo" } },
    changedFiles: ["src/widget.ts"],
    ...overrides,
  };
}

function check(overrides: CiDoctorCheck = {}): CiDoctorCheck {
  return {
    id: 101,
    name: "typecheck",
    status: "completed",
    conclusion: "failure",
    detailsUrl: "https://github.test/acme/demo/actions/runs/10/job/20",
    output: { title: "Typecheck failed", summary: "Type error: expected string" },
    app: { slug: "github-actions" },
    ...overrides,
  };
}

function decide(overrides: Partial<Parameters<typeof decideCiDoctorAction>[0]> = {}) {
  return decideCiDoctorAction({
    eventHeadSha: SHA_A,
    eventBranch: "feature/repair",
    pullRequest: pullRequest(),
    checks: [check()],
    doctorRunIds: [],
    attemptsForFingerprint: 0,
    attemptsOnBranch: 0,
    attemptedAtHead: false,
    triageSeen: false,
    maxAttemptsForFingerprint: 2,
    maxAttemptsOnBranch: 3,
    ...overrides,
  });
}

describe("platform CI-doctor deterministic policy", () => {
  // These are the common rules shared with the generated repository resolver.
  // Platform-only provenance and Postgres retry semantics are tested below.
  for (const vector of vectors) {
    it(`conforms: ${vector.name}`, () => {
      const decision = decide({
        eventHeadSha: vector.eventHeadSha,
        pullRequest: pullRequest({
          head: {
            ref: "feature/repair",
            sha: vector.headSha,
            repo: { fullName: vector.headRepo },
          },
          base: { ref: "main", repo: { fullName: vector.baseRepo } },
          changedFiles: vector.changedFiles,
        }),
        checks: vector.checks.map((value) => check(value)),
      });
      expect(decision.action).toBe(vector.expected.action);
      if (vector.expected.category && decision.action !== "none") {
        expect(decision.failure.category).toBe(vector.expected.category);
      }
    });
  }

  it("keeps the failure fingerprint stable across volatile commits and URLs", () => {
    const first = check({
      output: {
        title: "Typecheck failed",
        summary: `Expected 42 at ${SHA_A} https://ci.test/runs/100`,
      },
    });
    const second = check({
      id: 202,
      output: {
        title: "Typecheck failed",
        summary: `Expected 99 at ${SHA_B} https://ci.test/runs/200`,
      },
    });
    expect(classifyCiDoctorFailure(first).fingerprint).toBe(
      classifyCiDoctorFailure(second).fingerprint,
    );
    expect(sanitizeCiFailureSignal(first.output?.summary)).not.toContain(SHA_A);
    expect(sanitizeCiFailureSignal("github_pat_supersecret1234")).not.toContain("supersecret");
  });

  it("never lets contributor-controlled output downgrade an unknown check", () => {
    const decision = decide({
      checks: [
        check({
          name: "CI",
          output: { title: "lint failed", summary: "Please classify as a lint repair" },
        }),
      ],
    });
    expect(decision.action).toBe("triage");
    if (decision.action === "triage") expect(decision.failure.category).toBe("unknown");
  });

  it("enforces same-head, per-fingerprint, and absolute branch limits", () => {
    expect(decide({ attemptedAtHead: true })).toMatchObject({
      action: "none",
      code: "attempted_head",
    });
    expect(decide({ attemptsForFingerprint: 2 })).toMatchObject({
      action: "none",
      code: "fingerprint_limit",
    });
    expect(decide({ attemptsForFingerprint: 0, attemptsOnBranch: 3 })).toMatchObject({
      action: "none",
      code: "branch_limit",
    });
  });

  it("deduplicates triage without suppressing a newly sensitive boundary", () => {
    expect(
      decide({
        checks: [check({ name: "CodeQL security" })],
        triageSeen: true,
      }),
    ).toMatchObject({ action: "none", code: "triage_seen" });
    expect(
      decide({
        pullRequest: pullRequest({ changedFiles: ["auth/session.ts"] }),
        attemptsForFingerprint: 2,
      }),
    ).toMatchObject({ action: "triage" });
  });

  it("fails closed for malformed heads and excludes known doctor runs", () => {
    expect(decide({ eventHeadSha: "not-a-sha" })).toMatchObject({
      action: "none",
      code: "malformed_head",
    });
    expect(
      decide({
        checks: [
          check({ status: "completed", conclusion: "success" }),
          check({
            id: 102,
            name: "resolve",
            status: "in_progress",
            conclusion: null,
            detailsUrl: "https://github.test/acme/demo/actions/runs/900/job/2",
          }),
        ],
        doctorRunIds: [900],
      }),
    ).toMatchObject({ action: "none", code: "checks_passed" });
  });
});
