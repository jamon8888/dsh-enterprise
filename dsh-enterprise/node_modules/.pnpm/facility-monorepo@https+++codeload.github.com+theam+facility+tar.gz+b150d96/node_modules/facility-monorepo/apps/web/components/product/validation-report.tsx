"use client";

import { StatusDot } from "@facility/ui";
import type { ValidationReport } from "@/lib/kb-client";

/**
 * Renders the harness validator's report — shared by the new-page dry-run
 * preview and by 400 responses on create/patch/supersede (the API returns
 * the report as the error detail).
 */
export function ValidationReportPanel({ report }: { report: ValidationReport }) {
  if (report.errors.length === 0 && report.warnings.length === 0) {
    return (
      <p className="flex items-center gap-2 border border-(--line) px-4 py-2.5 text-[12px] text-(--mut)">
        <StatusDot tone="ok" /> validation passed
      </p>
    );
  }
  return (
    <div className="flex flex-col border border-(--line)">
      {report.errors.map((issue, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reorders
          key={`e${i}`}
          className="flex items-baseline gap-3 border-b border-(--line) px-4 py-2.5 last:border-b-0"
        >
          <StatusDot tone="bad" />
          <span className="font-mono text-[10.5px] text-(--dim)">{issue.code}</span>
          <span className="min-w-0 text-[12px] text-(--mut)">
            {issue.entry ? `${issue.entry}: ` : ""}
            {issue.message}
          </span>
        </div>
      ))}
      {report.warnings.map((issue, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reorders
          key={`w${i}`}
          className="flex items-baseline gap-3 border-b border-(--line) px-4 py-2.5 last:border-b-0"
        >
          <StatusDot tone="machine" />
          <span className="font-mono text-[10.5px] text-(--dim)">{issue.code}</span>
          <span className="min-w-0 text-[12px] text-(--dim)">
            {issue.entry ? `${issue.entry}: ` : ""}
            {issue.message}
          </span>
        </div>
      ))}
    </div>
  );
}
