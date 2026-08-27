"use client";

import { cx } from "@facility/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/projects", label: "Projects" },
  { href: "/projects/stats", label: "Stats" },
];

export function ProjectsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Projects sections" className="flex gap-6 border-b border-(--line)">
      {TABS.map((tab) => {
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
