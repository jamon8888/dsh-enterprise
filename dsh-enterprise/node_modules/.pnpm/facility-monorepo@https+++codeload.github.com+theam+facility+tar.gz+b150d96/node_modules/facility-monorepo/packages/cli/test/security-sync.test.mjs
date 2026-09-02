import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseSecurityReport,
  qualifyingSecurityFindings,
  redactSecurityText,
  securityFindingMarker,
  syncSecurityReport,
} from "../templates/security/sync-findings.mjs";

function report(findings) {
  return parseSecurityReport({
    schema: "facility.security.findings.v1",
    findings,
    dismissed: [],
    scanners_not_enabled: [],
  });
}

function finding(overrides = {}) {
  return {
    fingerprint: "auth-admin-bypass",
    title: "Admin authorization bypass",
    severity: "high",
    confidence: "high",
    actionable: true,
    risk: "A reachable route skips authorization.",
    locations: ["src/admin.ts:42"],
    smallest_fix: "Apply the shared authorization guard.",
    evidence: ["receipt://security/run-1"],
    ...overrides,
  };
}

test("trusted security sync qualifies only actionable high-confidence high/critical findings", () => {
  const parsed = report([
    finding(),
    finding({ fingerprint: "medium", severity: "medium" }),
    finding({ fingerprint: "uncertain", confidence: "medium" }),
    finding({ fingerprint: "non-actionable", actionable: false }),
  ]);
  assert.deepEqual(
    qualifyingSecurityFindings(parsed).map((item) => item.fingerprint),
    ["auth-admin-bypass"],
  );
});

test("trusted security sync updates and reopens the fingerprinted issue", () => {
  const parsed = report([finding()]);
  const calls = [];
  const marker = securityFindingMarker("auth-admin-bypass");
  const gh = (args, input) => {
    calls.push({ args, input });
    if (args[0] === "label") return null;
    if (args[1]?.includes("issues?")) {
      return [{ number: 17, state: "closed", body: `old\n${marker}` }];
    }
    return { number: 17, html_url: "https://github.test/acme/repo/issues/17" };
  };

  const result = syncSecurityReport(parsed, { repo: "acme/repo", sourceRun: "123", gh });

  assert.equal(result.eligible, 1);
  assert.equal(result.synced[0].created, false);
  const patch = calls.find((call) => call.args.includes("PATCH"));
  assert.equal(patch.input.state, "open");
  assert.match(patch.input.body, /Start with `\/architect`/);
  assert.match(patch.input.body, /facility-security-fingerprint/);
});

test("trusted security rendering redacts common credentials", () => {
  assert.equal(redactSecurityText("token ghp_abcdefghijklmnopqrstuvwxyz123456"), "token «redacted»");
  assert.throws(() => parseSecurityReport({ schema: "wrong", findings: [] }));
  assert.throws(() => report([finding({ fingerprint: "not a stable slug" })]));
});
