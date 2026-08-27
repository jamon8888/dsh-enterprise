import { artifactIdFor, type HarnessKbEntry, type ValidationIssue } from "./validate.js";

export type ProvenanceConfig = {
  staleDaysByType?: Record<string, number>;
  now?: Date;
};

export function provenance(entries: HarnessKbEntry[], config: ProvenanceConfig = {}) {
  const warnings: ValidationIssue[] = [];
  const byId = new Map(entries.map((entry) => [artifactIdFor(entry), entry]));
  const now = config.now ?? new Date();
  const verificationsByTask = new Map<string, number>();

  for (const entry of entries) {
    const supersedes = entry.supersedes ?? stringField(entry.frontmatter.supersedes);
    if (supersedes && !byId.has(supersedes)) {
      warnings.push({
        code: "superseded_ref_missing",
        message: `${artifactIdFor(entry)} supersedes missing ${supersedes}`,
        entryId: entry.id,
      });
    }
    const staleDays = config.staleDaysByType?.[entry.type];
    const created = stringField(entry.frontmatter.created);
    if (staleDays && created) {
      const ageMs = now.getTime() - new Date(created).getTime();
      if (Number.isFinite(ageMs) && ageMs > staleDays * 86_400_000) {
        warnings.push({
          code: "entry_stale",
          message: `${artifactIdFor(entry)} is older than ${staleDays} days`,
          entryId: entry.id,
        });
      }
    }
    if (entry.type === "V") {
      const task = stringField(entry.frontmatter.task);
      if (task) verificationsByTask.set(task, (verificationsByTask.get(task) ?? 0) + 1);
    }
  }

  for (const [task, count] of verificationsByTask) {
    if (count > 1) {
      warnings.push({
        code: "multiple_verifications_for_task",
        message: `${task} has ${count} verification artifacts`,
      });
    }
  }
  return { warnings };
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
