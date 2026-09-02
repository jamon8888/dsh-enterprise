"use client";

import { useState } from "react";

/**
 * The copyable reference chip: puts the artifact id (D001, R002, …) on the
 * clipboard so it can be cited in issues, PRs, and other KB pages.
 */
export function CopyRef({ artifactId }: { artifactId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`copy "${artifactId}" to reference this page elsewhere`}
      onClick={() => {
        void navigator.clipboard?.writeText(artifactId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1_500);
        });
      }}
      className="inline-flex items-center gap-1 border border-(--line) px-1.5 py-0.5 font-mono text-[10.5px] text-(--dim) transition-colors hover:border-(--line-strong) hover:text-(--ink)"
    >
      {copied ? "copied" : "copy ref"}
    </button>
  );
}
