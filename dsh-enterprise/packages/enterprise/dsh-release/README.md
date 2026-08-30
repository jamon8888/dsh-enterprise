# @deepseek-ai/dsh-enterprise-dsh-release

CycloneDX SBOM generation + cosign keyless signing as a Cordis plugin.

## Quick start

```sh
npm install @deepseek-ai/dsh-enterprise-dsh-release
```

```ts
import { ReleaseService } from '@deepseek-ai/dsh-enterprise-dsh-release'

const svc = new ReleaseService('/path/to/project')
const result = await svc.cut('1.0.0')
// result: { version: '1.0.0', sbom: 'sbom-1.0.0.json', signed: true|false }
```

## How it works

Wraps the `syft` and `cosign` CLI tools:

- **SBOM** — runs `syft <dir> -o cyclonedx-json=<output>` (falls back to `cyclonedx-gomod` if `syft` is absent)
- **Signing** — runs `cosign sign --yes --tlog-upload=true <sbom>` for keyless attestation

## Stub behaviour

When `syft` or `cosign` is not on `PATH`, the service returns a stub and logs a warning — it never throws. Install the tools to unlock full SBOM generation and attestation.

| Tool | Install |
|------|---------|
| syft | `curl -sSfL https://raw.githubusercontent.com/wagoodman/syft/main/install.sh | sh` |
| cosign | `curl -sSfL https://raw.githubusercontent.com/sigstore/cosign/main/install.sh | sh` |

## API

```ts
// Generate SBOM only
await svc.generateSbom({ tool: 'syft', output: 'sbom.json' })

// Sign an existing SBOM
await svc.cosignSign('sbom.json')

// Cut a release: generate SBOM + sign in one step
const result = await svc.cut('1.0.0', { sbomTool: 'syft' })
```
