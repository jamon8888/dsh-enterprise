"use client";

import type { KbEntry, KbNeighbor } from "./kb";

/**
 * Client-side KB mutations through the same-origin /api proxy (cookie auth).
 * Centralizes the fetch + error-shape handling the Product tab needs; server
 * components keep using lib/api.ts.
 */

export type KbClientError = {
  status: number;
  code: string;
  message: string;
  /** The validator's report when the API returns one (400 create/patch). */
  report?: ValidationReport;
};

export type ValidationIssue = { code: string; message: string; entry?: string };
export type ValidationReport = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type KbResult<T> = { ok: true; data: T } | { ok: false; error: KbClientError };

async function req<T>(method: string, path: string, body?: unknown): Promise<KbResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const payload = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; detail?: unknown };
    } | null;
    if (!res.ok) {
      const detail = payload?.error?.detail;
      const report =
        detail && typeof detail === "object" && Array.isArray((detail as ValidationReport).errors)
          ? (detail as ValidationReport)
          : undefined;
      return {
        ok: false,
        error: {
          status: res.status,
          code: payload?.error?.code ?? `http_${res.status}`,
          message: payload?.error?.message ?? `request failed (${res.status})`,
          report,
        },
      };
    }
    return { ok: true, data: payload as T };
  } catch (err) {
    return {
      ok: false,
      error: {
        status: 0,
        code: "network",
        message: err instanceof Error ? err.message : "network error",
      },
    };
  }
}

/**
 * The PUT is partial: send only what changed. Never default `config` — a
 * stray `{}` would wipe the space's chain configuration.
 */
export function saveSpace(
  projectId: string,
  body: { charterMd?: string; activeMd?: string; config?: Record<string, unknown> },
) {
  return req("PUT", `/v1/projects/${projectId}/kb/space`, body);
}

export type CreateEntryBody = {
  type: string;
  slug: string;
  frontmatter?: Record<string, unknown>;
  bodyMd: string;
  status?: string;
  links?: string[];
};

export type DryRunResult = {
  ok: boolean;
  entry: KbEntry & { artifactId?: string };
  report: ValidationReport;
};

export function createEntryDry(projectId: string, body: CreateEntryBody) {
  return req<DryRunResult>("POST", `/v1/projects/${projectId}/kb/entries?dry=1`, body);
}

export function createEntry(projectId: string, body: CreateEntryBody) {
  return req<KbEntry>("POST", `/v1/projects/${projectId}/kb/entries`, body);
}

export function patchEntry(
  entryId: string,
  body: { slug?: string; frontmatter?: Record<string, unknown>; bodyMd?: string; status?: string },
) {
  return req<KbEntry>("PATCH", `/v1/kb/entries/${entryId}`, body);
}

export function supersedeEntry(
  entryId: string,
  body: {
    slug?: string;
    frontmatter?: Record<string, unknown>;
    bodyMd: string;
    status?: string;
  },
) {
  return req<KbEntry>("POST", `/v1/kb/entries/${entryId}/supersede`, body);
}

export type Neighborhood = {
  entry: KbEntry;
  artifactId: string;
  linked: KbNeighbor[];
};

export function fetchNeighborhood(entryId: string) {
  return req<Neighborhood>("GET", `/v1/kb/entries/${entryId}/neighborhood`);
}

export function searchKb(projectId: string, q: string, type?: string) {
  const query = new URLSearchParams({ q });
  if (type) query.set("type", type);
  return req<KbEntry[]>("GET", `/v1/projects/${projectId}/kb/search?${query.toString()}`);
}
