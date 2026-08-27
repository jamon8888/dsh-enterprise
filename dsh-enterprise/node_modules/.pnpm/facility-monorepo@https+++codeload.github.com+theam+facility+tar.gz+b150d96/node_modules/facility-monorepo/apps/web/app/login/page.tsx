"use client";

import { ButtonLink } from "@facility/ui";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[22px] font-semibold tracking-tight">
          facility<span className="text-(--accent)">.</span>
        </span>
        <p className="text-sm leading-relaxed text-(--mut)">
          Agents build. People decide twice. Everything gets measured.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <ButtonLink href="/api/auth/login" variant="primary" size="lg">
          continue with GitHub
        </ButtonLink>
      </div>

      <p className="font-mono text-[10px] leading-relaxed text-(--dim)">
        An initiative by{" "}
        <a href="https://theagilemonkeys.com" className="underline-offset-4 hover:underline">
          The Agile Monkeys
        </a>
      </p>
    </div>
  );
}
