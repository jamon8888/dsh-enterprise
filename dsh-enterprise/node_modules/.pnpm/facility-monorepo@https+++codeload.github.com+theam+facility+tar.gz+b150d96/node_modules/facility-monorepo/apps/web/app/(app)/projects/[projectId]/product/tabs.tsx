"use client";

import { cx } from "@facility/ui";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

/** Product's two faces: the knowledge base and the PO chat sessions. */
export function ProductTabs() {
  const pathname = usePathname();
  const params = useParams<{ projectId: string }>();
  const base = `/projects/${params.projectId}/product`;
  const tabs = [
    { href: base, label: "Knowledge Base" },
    { href: `${base}/sessions`, label: "Sessions" },
  ];
  return (
    // The bottom hairline is the host header's — tabs only carry the active
    // indicator, which overlaps it by 1px.
    <nav aria-label="Product sections" className="flex gap-6">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 pb-2.5 text-[13px] transition-colors",
              active
                ? "border-(--line-strong) font-medium text-(--ink)"
                : "border-transparent text-(--mut) hover:text-(--ink)",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
