/**
 * Stub types for `@facility/mcp` — private facility package.
 * Divergence: facility/packages/mcp is services-bound (requires live Facility API),
 * DSH Enterprise MCP is Cordis-plugin bound (ctx.get('chains') etc.) — service
 * reimplementation per SPEC.md:3.1 "service reimplementation" note for non-publishable
 * facility services. This stub allows `tsc --skipLibCheck` to pass without
 * requiring `pnpm install` of the private github dep to have built `dist/`.
 * If `@facility/mcp` is resolvable (pnpm install github:theam/facility#b150d96
 * + `pnpm --filter @facility/mcp build`), this declaration is augmented, not
 * used. Documented divergence: enterprise MCP does not proxy Facility API;
 * it proxies Cordis services (chains, gateway, watchtower, iit, guards).
 * @module @facility/mcp (stub)
 */

declare module '@facility/mcp' {
  export type FacilityMcpOptions = { apiUrl: string; apiKey: string; fetch?: typeof fetch }
  export function createFacilityMcpServer(options: FacilityMcpOptions): unknown
  export const toolDefinitions: unknown[]
}
