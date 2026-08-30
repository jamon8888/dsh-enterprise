# Changelog — dsh-enterprise v0.1.0

## guards-iit (flagship)
- iit-core WASM wired as primary path — no more Python sidecar in hot path
- Pure JS fallback last-resort for all 11 IIT guards
- 68 tests, 100% coverage on guards-iit
- Commercial README with per-guard docs + ponytail upgrade paths

## Bundle
- `@deepseek-ai/dsh-enterprise` named and published-ready
- `enterprise.patch.yml` lists all 22 plugins (real + stubs marked disabled)
- Root README: IIT guards as flagship, plugin catalog, ponytail upgrade table
- FACILITY.md: documents facility relationship and graceful fallback

## CI/CD
- `.github/workflows/ci.yml`: Node 22/23 matrix, test → typecheck → coverage gate
- `.github/workflows/publish.yml`: npm publish on v* tags, syft + cosign auto-install

## dsh-release
- syft + cosign in publish CI → real CycloneDX SBOM + cosign attestation
- Stub mode when binaries absent

## ponytail ceilings
| Stub | Lifts when |
|------|-----------|
| dsh-mneme | better-sqlite3 native addon |
| kb-rag | PG pgvector extension |
| dsh-model-router | gateway PG with cost/latency tables |
| dsh-release | syft + cosign on CI host |
