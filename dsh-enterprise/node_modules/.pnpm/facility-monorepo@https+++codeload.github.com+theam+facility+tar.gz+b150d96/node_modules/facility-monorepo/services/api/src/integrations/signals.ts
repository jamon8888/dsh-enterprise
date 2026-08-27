import type { FacilityDb } from "@facility/db";
import { z } from "zod";
import {
  type IssueProjectScope,
  type IssueSeverity,
  normalizeSeverity,
  raisePlatformIssue,
  resolvePlatformIssue,
} from "../watchtower/issues.js";

export const FacilitySignalSchema = z
  .object({
    schema: z.literal("facility.signal.v1"),
    type: z.enum(["issue", "deployment", "security", "check"]),
    status: z.enum(["failed", "recovered", "pending", "succeeded"]),
    projectId: z.string().min(1).optional(),
    fingerprint: z.string().min(1).max(500).optional(),
    title: z.string().min(1).max(500).optional(),
    bodyMd: z.string().max(100_000).optional(),
    severity: z.string().min(1).max(40).optional(),
    source: z.string().min(1).max(200).optional(),
    url: z.string().url().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type FacilitySignal = z.infer<typeof FacilitySignalSchema>;

export async function applyFacilitySignal(
  db: FacilityDb,
  input: {
    orgId: string;
    projectId: string | null;
    signal: FacilitySignal;
    fallbackFingerprint: string;
    issueScope?: IssueProjectScope;
  },
) {
  const status = input.signal.status;
  const fingerprint =
    input.signal.fingerprint ??
    `${input.signal.type}:${input.signal.source ?? "inbound"}:${input.fallbackFingerprint}`;
  if (status === "recovered" || status === "succeeded") {
    const issue = await resolvePlatformIssue(
      db,
      input.orgId,
      fingerprint,
      `${input.signal.type} signal recovered with status ${status}`,
      input.issueScope,
    );
    return { action: "resolved" as const, issue };
  }
  if (status === "pending") return { action: "ignored" as const, issue: null };

  const severity = signalSeverity(input.signal);
  const issue = await raisePlatformIssue(
    db,
    {
      orgId: input.orgId,
      projectId: input.projectId,
      kind: signalKind(input.signal.type),
      severity,
      fingerprint,
      title: input.signal.title ?? `${capitalize(input.signal.type)} ${status}`,
      bodyMd: signalBody(input.signal, status),
    },
    input.issueScope,
  );
  return { action: "raised" as const, issue };
}

function signalKind(type: FacilitySignal["type"]) {
  if (type === "deployment") return "deployment_failure";
  if (type === "security") return "security_finding";
  if (type === "check") return "check_failure";
  return "generic_inbound";
}

function signalSeverity(signal: FacilitySignal): IssueSeverity {
  if (signal.severity) return normalizeSeverity(signal.severity);
  return signal.type === "issue" ? "warn" : "error";
}

function signalBody(signal: FacilitySignal, status: string) {
  const lines = [signal.bodyMd ?? `${capitalize(signal.type)} status: ${status}.`];
  if (signal.source) lines.push(`Source: ${signal.source}`);
  if (signal.url) lines.push(`Evidence: ${signal.url}`);
  return lines.join("\n\n");
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
