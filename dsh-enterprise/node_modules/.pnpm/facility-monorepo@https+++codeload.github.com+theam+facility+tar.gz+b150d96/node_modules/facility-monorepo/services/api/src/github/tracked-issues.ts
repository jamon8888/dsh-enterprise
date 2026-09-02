import { createHash } from "node:crypto";
import type { FacilityGithubClient } from "./client.js";

const MAX_ISSUE_PAGES = 10;
const PAGE_SIZE = 100;

export type TrackedIssueInput = {
  kind: "learning" | "security";
  fingerprint: string;
  title: string;
  body: string;
  labels: Array<{ name: string; color: string; description: string }>;
  reopen?: boolean;
};

export function trackedIssueMarker(kind: TrackedIssueInput["kind"], fingerprint: string) {
  const digest = createHash("sha256").update(fingerprint).digest("hex");
  return `<!-- facility-${kind}-fingerprint: ${digest} -->`;
}

export async function ensureTrackedIssue(
  client: FacilityGithubClient,
  input: TrackedIssueInput,
): Promise<{ number: number; url: string; created: boolean; updated: boolean }> {
  const marker = trackedIssueMarker(input.kind, input.fingerprint);
  const body = trackedIssueBody(input.body, marker);
  const labelNames = input.labels.map((label) => label.name);
  for (const label of input.labels) await client.ensureLabel(label);

  for (let page = 1; page <= MAX_ISSUE_PAGES; page += 1) {
    const issues = await client.listIssues({ state: "all", page, perPage: PAGE_SIZE });
    for (const raw of issues) {
      const issue = issueRecord(raw);
      if (issue.pull_request || typeof issue.number !== "number") continue;
      if (typeof issue.body !== "string" || !issue.body.includes(marker)) continue;
      if (
        issue.state === "closed" &&
        input.reopen === false &&
        typeof issue.html_url === "string"
      ) {
        return { number: issue.number, url: issue.html_url, created: false, updated: false };
      }
      const existingLabels = Array.isArray(issue.labels)
        ? issue.labels
            .map((label) => {
              if (typeof label === "string") return label;
              const record = issueRecord(label);
              return typeof record.name === "string" ? record.name : "";
            })
            .filter(Boolean)
        : [];
      const updated = await client.updateIssue(issue.number, {
        title: input.title,
        body,
        labels: [...new Set([...existingLabels, ...labelNames])],
        state: issue.state === "closed" && input.reopen === false ? "closed" : "open",
      });
      return { ...updated, created: false, updated: true };
    }
    if (issues.length < PAGE_SIZE) break;
  }

  const created = await client.createIssue({ title: input.title, body, labels: labelNames });
  return { ...created, created: true, updated: false };
}

function trackedIssueBody(body: string, marker: string) {
  const suffix = `\n\n${marker}`;
  const limit = 64 * 1024 - Buffer.byteLength(suffix) - 256;
  let bounded = body.trimEnd();
  if (Buffer.byteLength(bounded) > limit) {
    while (Buffer.byteLength(bounded) > limit) {
      bounded = bounded.slice(0, Math.max(0, Math.floor(bounded.length * 0.9)));
    }
    bounded = `${bounded.trimEnd()}\n\n_Description truncated; follow the linked evidence for the full proposal._`;
  }
  return `${bounded}${suffix}`;
}

function issueRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
