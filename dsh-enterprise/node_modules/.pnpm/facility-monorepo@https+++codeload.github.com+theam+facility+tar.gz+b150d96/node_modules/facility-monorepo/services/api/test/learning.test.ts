import { randomInt } from "node:crypto";
import { newId, sealFacilityReceipt } from "@facility/core";
import {
  actionTypes,
  budgets,
  createDb,
  githubInstallations,
  insertAuditEvent,
  migrate,
  outcomes,
  platformIssues,
  projects,
  proposalEvents,
  proposals,
  repos,
  runEvents,
  runs,
  seed,
  spendCounters,
} from "@facility/db";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { Octokit } from "../src/github/client.js";
import {
  assembleLearningPacket,
  attachGithubReviewEvidence,
  boundLearningPacket,
  LEARNING_PACKET_MAX_CHARS,
} from "../src/learning.js";
import type { AppConfig } from "../src/types.js";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://facility:facility@127.0.0.1:5461/facility_test";

async function canConnect() {
  const sqlClient = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
  try {
    await sqlClient`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sqlClient.end().catch(() => undefined);
  }
}

describe("learning evidence packet", async () => {
  const reachable = await canConnect();
  if (!reachable) {
    it.skip("Postgres unreachable; learning tests skipped", () => undefined);
    return;
  }

  const config: AppConfig = {
    databaseUrl,
    secretMasterKey: Buffer.alloc(32, 14).toString("base64"),
    port: 4415,
    publicUrl: "http://127.0.0.1:0",
    sandboxApiUrl: "http://127.0.0.1:0",
    sandboxGatewayUrl: "http://127.0.0.1:0",
    gatewayUrl: "http://localhost:4410",
    sandboxRunnerImage: "facility-runner:dev",
    sandboxDriver: "docker",
    facilityInsecureDev: true,
    logLevel: "silent",
  };
  const { db, client } = createDb(databaseUrl);
  const app = await buildApp(config);
  let orgId = "";
  let projectId = "";

  beforeAll(async () => {
    await migrate(databaseUrl);
    await seed(databaseUrl);
    await app.ready();
    const login = await app.inject({
      method: "POST",
      url: "/__test/session",
      payload: { email: `learning-${Date.now()}@example.com` },
    });
    orgId = login.json().orgId;
    projectId =
      (
        await db
          .insert(projects)
          .values({
            id: newId("proj"),
            orgId,
            name: "Learning evidence",
            slug: `learning-${Date.now()}`,
            settings: {},
          })
          .returning()
      )[0]?.id ?? "";
  });

  afterAll(async () => {
    await app.close();
    await client.end();
  });

  it("joins receipts, guards, outcomes, review threads, budget breaches, and rejections", async () => {
    const now = new Date();
    const prNumber = randomInt(100_000, 1_000_000_000);
    const runId = newId("run");
    const repoName = `learning-mirror-${runId.slice(-8)}`;
    const repoFullName = `theam/${repoName}`;
    const receipt = sealFacilityReceipt(
      {
        schema: "facility.run.v1",
        run_id: runId,
        project_id: projectId,
        provider: "claude_code",
        mode: "builder",
        result: "succeeded",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cost_cents: 2,
          cost_source: "gateway",
        },
        activity: {
          turns: 1,
          shell_commands: 1,
          file_changes: 1,
          mcp_tool_calls: 0,
          web_searches: 0,
          tool_calls: 2,
          errors: 0,
        },
        timing: { started_at: now.toISOString(), ended_at: now.toISOString(), duration_ms: 1 },
      },
      null,
    );
    await db.insert(runs).values({
      id: runId,
      orgId,
      projectId,
      mode: "builder",
      engine: "claude",
      status: "succeeded",
      trigger: {},
      createdBy: { type: "system", id: "test" },
      receipt,
      createdAt: now,
      updatedAt: now,
    });
    await insertAuditEvent(db, {
      orgId,
      projectId,
      actor: { type: "system", id: "learning-test" },
      action: "run.finished",
      target: { type: "run", id: runId },
      payload: { receipt_sha256: receipt.integrity?.payload_sha256 },
    });
    await db.insert(runEvents).values({
      orgId,
      runId,
      seq: 1,
      ts: now,
      type: "check",
      data: { name: "test", status: "passed" },
    });
    await db.insert(outcomes).values({
      id: newId("evt"),
      orgId,
      projectId,
      runId,
      repo: repoFullName,
      prNumber,
      agentLane: "claude_code",
      openedAt: now,
      accepted: false,
      reviewRounds: 1,
    });
    const actionTypeId = newId("act");
    await db.insert(actionTypes).values({
      id: actionTypeId,
      orgId,
      name: `learning_rejection_${Date.now()}`,
      payloadSchema: { type: "object" },
      resolver: { type: "permission", config: { permission: "hitl:decide" } },
      executor: { type: "none" },
      defaultTtlHours: 24,
    });
    const proposalId = newId("prop");
    await db.insert(proposals).values({
      id: proposalId,
      orgId,
      projectId,
      actionTypeId,
      payload: {},
      contextMd: "Rejected because it weakened an existing guard.",
      state: "rejected",
      expiresAt: new Date(now.getTime() + 86_400_000),
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(proposalEvents).values({
      orgId,
      proposalId,
      seq: 1,
      ts: now,
      type: "decided",
      actor: { type: "user", id: "reviewer" },
      data: { decision: "reject" },
    });
    const recurrenceFingerprint = `learning:recurrence:${runId}`;
    const recentRecurrenceFingerprint = `learning:recurrence:recent:${runId}`;
    const activatedAt = new Date(now.getTime() - 8 * 86_400_000);
    const firstSeen = new Date(now.getTime() - 16 * 86_400_000);
    const recentFirstSeen = new Date(now.getTime() - 12 * 86_400_000);
    await db.insert(platformIssues).values({
      id: newId("iss"),
      orgId,
      projectId,
      kind: "agent_failure",
      severity: "warn",
      fingerprint: recurrenceFingerprint,
      title: "Repeated review regression",
      bodyMd: "The same review invariant failed four times before the learned skill activated.",
      state: "resolved",
      firstSeen,
      lastSeen: activatedAt,
      count: 4,
    });
    await db.insert(platformIssues).values({
      id: newId("iss"),
      orgId,
      projectId,
      kind: "agent_failure",
      severity: "warn",
      fingerprint: recentRecurrenceFingerprint,
      title: "Recent review regression",
      bodyMd: "A second, more frequent pattern stopped after activation.",
      state: "resolved",
      firstSeen: recentFirstSeen,
      lastSeen: activatedAt,
      count: 8,
    });
    const skillAction = (
      await db.select().from(actionTypes).where(eq(actionTypes.name, "skill_proposal")).limit(1)
    )[0];
    if (!skillAction) throw new Error("seeded skill proposal action missing");
    const improvementProposalId = newId("prop");
    await db.insert(proposals).values({
      id: improvementProposalId,
      orgId,
      projectId,
      actionTypeId: skillAction.id,
      payload: {
        name: "preserve-review-invariants",
        content: "Preserve explicitly requested invariants.",
        evidence_refs: [`issue://${recurrenceFingerprint}`],
        recurrence_fingerprints: [recurrenceFingerprint, recentRecurrenceFingerprint],
        evaluation_window_days: 7,
      },
      contextMd: "Four occurrences before activation.",
      state: "executed",
      expiresAt: new Date(now.getTime() + 86_400_000),
      createdAt: activatedAt,
      updatedAt: now,
    });
    await db.insert(proposalEvents).values({
      orgId,
      proposalId: improvementProposalId,
      seq: 1,
      ts: activatedAt,
      type: "executed",
      actor: { type: "user", id: "reviewer" },
      data: {
        actionType: "skill_proposal",
        recurrence: {
          configured: true,
          evaluationWindowDays: 7,
          fingerprints: [recurrenceFingerprint, recentRecurrenceFingerprint],
          baseline: [
            {
              fingerprint: recurrenceFingerprint,
              count: 4,
              firstSeen: firstSeen.toISOString(),
              lastSeen: activatedAt.toISOString(),
            },
            {
              fingerprint: recentRecurrenceFingerprint,
              count: 8,
              firstSeen: recentFirstSeen.toISOString(),
              lastSeen: activatedAt.toISOString(),
            },
          ],
        },
      },
    });
    const budgetId = newId("bud");
    await db.insert(budgets).values({
      id: budgetId,
      orgId,
      scope: "project",
      projectId,
      period: "daily",
      limitCents: 100,
      mode: "soft",
      enabled: true,
    });
    await db.insert(spendCounters).values({
      id: newId("evt"),
      orgId,
      budgetId,
      windowStart: now.toISOString().slice(0, 10),
      spentCents: 125,
    });
    const installationId = newId("ghi");
    await db.insert(githubInstallations).values({
      id: installationId,
      orgId,
      installationId: Number(String(Date.now()).slice(-9)),
      accountLogin: "theam",
      targetType: "Organization",
    });
    await db.insert(repos).values({
      id: newId("repo"),
      orgId,
      projectId,
      installationId,
      owner: "theam",
      name: repoName,
      defaultBranch: "main",
    });

    const base = await assembleLearningPacket(db, orgId, projectId, now);
    const packet = await attachGithubReviewEvidence(
      db,
      base,
      async () =>
        ({
          rest: {
            pulls: {
              listReviews: async () => ({
                data: [{ id: 1, state: "CHANGES_REQUESTED", body: "Keep the invariant." }],
              }),
              listReviewComments: async () => ({
                data: [{ id: 2, path: "src/a.ts", line: 4, body: "This bypasses the guard." }],
              }),
            },
          },
        }) as unknown as Octokit,
    );

    expect(packet.schema).toBe("facility.learning.packet.v2");
    expect(packet.window.days).toBe(30);
    expect(packet.proposalActionTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "skill_proposal" }),
        expect.objectContaining({ name: "rule_proposal" }),
        expect.objectContaining({ name: "guard_candidate" }),
        expect.objectContaining({ name: "kb_amendment" }),
      ]),
    );
    expect(packet.receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runId, integrity: { ok: true, errors: [] } }),
      ]),
    );
    expect(packet.guardResults).toEqual(
      expect.arrayContaining([expect.objectContaining({ runId, type: "check" })]),
    );
    expect(packet.budgetBreaches).toEqual(
      expect.arrayContaining([expect.objectContaining({ budgetId, exceededByCents: 25 })]),
    );
    expect(packet.historicalRejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proposal: expect.objectContaining({ id: proposalId }) }),
      ]),
    );
    expect(packet.improvementEffectiveness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          proposalId: improvementProposalId,
          status: "evaluated",
          trend: "reduced",
          beforeOccurrences: 12,
          afterOccurrences: 0,
          beforeRatePerDay: 2.5,
        }),
      ]),
    );
    expect(packet.githubReviewThreads).toEqual([
      expect.objectContaining({
        repo: repoFullName,
        pr: prNumber,
        reviews: [expect.objectContaining({ state: "CHANGES_REQUESTED" })],
        threads: [expect.objectContaining({ path: "src/a.ts", line: 4 })],
      }),
    ]);
    expect(packet.digestMd).toContain("GitHub review packets: 1");
    expect(packet.digestMd).toContain("Accepted improvements measured: 1");

    const bounded = boundLearningPacket({
      ...packet,
      runs: [
        ...packet.runs,
        {
          trigger: {
            type: "schedule",
            packet: { runEvents: Array.from({ length: 1_000 }, () => "x".repeat(10_000)) },
          },
        },
      ],
      runEvents: Array.from({ length: 1_000 }, (_, index) => ({
        index,
        output: "verbose evidence ".repeat(1_000),
      })),
    });
    expect(JSON.stringify(bounded).length).toBeLessThanOrEqual(LEARNING_PACKET_MAX_CHARS);
    expect(JSON.stringify(bounded.runs)).toContain("prior learning packet omitted");
    expect(bounded.evidenceWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining("runEvents records")]),
    );
  });
});
