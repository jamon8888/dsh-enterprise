import { describe, expect, it } from "vitest";
import openapiSpec from "../openapi.json" with { type: "json" };
import { FACILITY_V1_ROUTES } from "../src/routes.js";

// Drift guard: FACILITY_V1_ROUTES is the SDK's hand-maintained manifest of the
// control-plane surface. The Fastify app's OpenAPI document is the source of
// truth. If they diverge — the API added, removed, or renamed a /v1 route — this
// test fails, forcing the manifest (and the typed contracts derived from it) to
// be updated instead of silently drifting.
const openapi = openapiSpec as unknown as { paths: Record<string, Record<string, unknown>> };

const HTTP_METHODS = new Set(["get", "post", "patch", "delete", "put"]);

function routesFromOpenApi(): string[] {
  const rows: string[] = [];
  for (const [path, methods] of Object.entries(openapi.paths)) {
    if (!path.startsWith("/v1/")) continue;
    const normalized = path.replace(/\{([^}]+)\}/g, ":$1");
    for (const method of Object.keys(methods)) {
      if (HTTP_METHODS.has(method)) rows.push(`${method.toUpperCase()} ${normalized}`);
    }
  }
  return rows;
}

describe("SDK route manifest coverage", () => {
  it("matches the control plane's OpenAPI surface exactly", () => {
    const fromSpec = new Set(routesFromOpenApi());
    const fromManifest = new Set<string>(FACILITY_V1_ROUTES);

    const missingFromSdk = [...fromSpec].filter((route) => !fromManifest.has(route)).sort();
    const staleInSdk = [...fromManifest].filter((route) => !fromSpec.has(route)).sort();

    // Regenerate openapi.json (`pnpm --filter @facility/api openapi`) then update
    // src/routes.ts + the typed contracts if either list below is non-empty.
    expect({ missingFromSdk, staleInSdk }).toEqual({ missingFromSdk: [], staleInSdk: [] });
  });

  it("manifest is sorted and free of duplicates", () => {
    const list = [...FACILITY_V1_ROUTES];
    expect(new Set(list).size).toBe(list.length);
    expect(list).toEqual([...list].sort());
  });
});
