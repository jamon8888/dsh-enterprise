import type { HTMLAttributes } from "react";
import { cx } from "./cx";

/**
 * The signature card layout: 1px hairline seams via grid gap over a --line
 * backdrop. Children must set their own `bg-(--bg)` or `bg-(--card)`.
 */
export function HairlineGrid({
  className,
  cols = "sm:grid-cols-2 lg:grid-cols-3",
  ...props
}: HTMLAttributes<HTMLDivElement> & { cols?: string }) {
  return (
    <div
      className={cx("grid gap-px border border-(--line) bg-(--line)", cols, className)}
      {...props}
    />
  );
}

export function Cell({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        "group relative bg-(--bg) p-6 sm:p-8",
        interactive && "transition-colors hover:bg-(--card)",
        className,
      )}
      {...props}
    />
  );
}

/** Accent top bar that slides in on hover — marks agent-related cells only. */
export function CellAccent() {
  return (
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-(--accent) transition-transform duration-300 group-hover:scale-x-100"
    />
  );
}
