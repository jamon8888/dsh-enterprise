# Compliance Matrix — DORA / GDPR / AI Act / SOC2 / Souveraineté → DSH Enterprise Proofs

**Source:** `SPEC.md` §6 (auditability), §9.1-9.6 (regulated), `DETAILED_PLAN.md` §18.1-18.6, `IMPLEMENTATION_PLAN.md` §7-8

| Réglementation | Contrôle | Exigence banque/assurance | Preuve DSH Enterprise | Artifact vérifiable | Gate / Test |
|---|---|---|---|---|---|
| **GDPR Art.17** | Droit à l'effacement | Effacer PII sans casser audit | `erasure/tombstone{targetEventSeq, redactedHash}` + `Receipt.logHash` recomputé sur log où payload → `HMAC(redactedHash)` (`SPEC.md:9.3`) | `receipts/<hash>.json` + log canonique tombstoné | `compliance-erasure/tests/erasure.spec.ts` chain continuity + `receipt verify` post-erasure |
| **GDPR Art.30** | Registre traitement | Tracer qui traite quoi | `envelope-store` capture req/res + `budgets(scope, projectId)` + `BenchmarkEnvelope.runId` (`SPEC.md:5.2`) | `run_events` PG + R2 WORM | `gateway/tests/budgets.spec.ts` |
| **DORA Art.9** | IAM & SoD | Ségrégation trader/risk/audit | `auth` RBAC `checkPermission` + 4-eyes threshold 2 sur `iit-config`/`Teloid` edit (`SPEC.md:9.1`) | `audit/event{principal, disposition}` | `auth/tests/rbac.spec.ts` SoD block |
| **DORA Art.11** | Tests résilience | RTO 4h / RPO 0, chaos | PG PITR WAL + R2 cross-region replica + chaos `pod kill/partition` (`SPEC.md:9.4`) | `receipts-restore-YYYY-MM-DD.json` hash-chainé | `resilience/tests/chaos.spec.ts` |
| **DORA Art.28** | Concentration tiers | Dépendances pin & SBOM | `verify-deps.sh` SHA `b150d96` + `pnpm-lock.yaml` + `Cargo.lock` + SBOM CycloneDX (`SPEC.md:9.6`) | `sbom.cyclonedx.json` + SLSA `cosign` | `sbom/tests/sbom.spec.ts` `failOnCritical` |
| **AI Act Art.14** | Human oversight | Bloquer action non conforme | `effect-ethos` Teloids `deep_causality_core::Causaloid` severity `error` (`SPEC.md:9.5`, `4.1`) | `guardDispositions[{guardId:'effect-ethos', disposition:'block'}]` | `guards-iit/tests/effect-ethos.spec.ts` |
| **AI Act Art.61** | Transparence & traçabilité | Registre modèles + linkage | `model-registry{modelId, trainingDataHash, metrics, approvalBy}` + `envelope.modelId` (`SPEC.md:9.5`) | `model-registry` table + `Receipt.cost.modelRoute` | `model-registry/tests/registry.spec.ts` |
| **SOC2 CC6.1** | Logical access | Least privilege | `auth` OIDC/SAML JWKS + `roles` enum `schemastery` | `audit/event` login | `rbac.spec` |
| **SOC2 CC7.2** | System monitoring | Alerte coût/phi/ews | `watchtower` hourly + `BenchmarkEnvelope{phi, cuspDistance, ewsVariance}` + Grafana alerts (`SPEC.md:5.3`) | dashboard + `BenchmarkEnvelope` | `watchtower/tests/job.spec.ts` |
| **Souveraineté** | Data residency | EU-only | `sovereignty` `allowedRegions=['eu-west-1']` enforce in `gateway` + `envelope-store` before R2 put (`SPEC.md:9.2`) | `gateway` config + Helm `values-airgapped.yaml` | `sovereignty/tests/region.spec.ts` rejects `us-east-1` |
| **Solvency2 / ACPR** | Audit non-répudiation | Hash-chain ancrée | `Receipt{prevHash, logHash, hash=SHA256(canonical)}` seeded `H(genesis+orgId)` (`SPEC.md:6.2`) | `receipts` table append-only + WORM | `watchtower/tests/receipts.spec.ts` tamper detection |
| **SLSA L3** | Build provenance | Binaire signé | `cargo build --locked` + `cosign sign-blob pkg/*.wasm` + `builder.gitSha` dans `Receipt` (`SPEC.md:9.6`) | `*.wasm.sig` + provenance JSON | `verify-deps.sh` |

## Lecture auditeur

Avec seulement `receipts` + code public, l'auditeur peut (`SPEC.md:6.1`):
1. Rejouer `SessionEvent` log (seq contigu, `SESSION_FORMAT_VERSION` check)
2. Vérifier `logHash` + `hash` + `prevHash` chain → détecte insertion/drop
3. Recomputer `Φ/CES` via `ruvector::auto_compute_phi` (tol `1e-9` exact, `1e-3` approx) + `MIP` witness
4. Vérifier `guardDispositions` vs `.dsh/iit-config.yaml` versionné
5. Vérifier `cost` vs `envelope-store` captures
6. Suivre lineage `Verification→Task→Decision→Signal` (`S→D→T→V`)

Résiduels documentés (`SPEC.md:6.6`): `TokenUsage` provider-reported, TPM abstraction non-unique — `method` loggé.
