/**
 * dsh-release Cordis plugin — CycloneDX SBOM generation + cosign signing.
 * @module @deepseek-ai/dsh-enterprise-dsh-release/plugin
 */

// ponytail: CLI-based (syft/cosign); stubs when tools absent; upgrade path = install tools

import { execSync } from 'node:child_process'

export interface ReleaseOptions {
  version: string
  projectRoot?: string
  sbomTool?: 'syft' | 'cyclonedx-gomod'
}

export interface ReleaseResult {
  version: string
  sbom: string
  signed: boolean
}

function which(cmd: string): string | null {
  try {
    const r = execSync(`which ${cmd}`, { encoding: 'utf8', timeout: 10_000 })
    return r.trim() || null
  } catch {
    return null
  }
}

export class ReleaseService {
  constructor(private projectRoot = process.cwd()) {}

  async generateSbom(opts?: { tool?: 'syft' | 'cyclonedx-gomod'; output?: string }): Promise<string> {
    const tool = opts?.tool
    const output = opts?.output ?? 'sbom.json'

    if (tool) {
      const found = which(tool)
      if (!found) throw new Error(`sbom tool not found: ${tool}`)
      return this.runSbomTool(tool, this.projectRoot, output)
    }

    const candidate = ['syft', 'cyclonedx-gomod'] as const
    for (const t of candidate) {
      if (which(t)) return this.runSbomTool(t, this.projectRoot, output)
    }

    // ponytail: no SBOM tool on PATH → stub
    return 'sbom-stub.json'
  }

  private runSbomTool(tool: 'syft' | 'cyclonedx-gomod', projectRoot: string, output: string): string {
    // ponytail: syft CLI → CycloneDX JSON SBOM when binary on PATH; stub otherwise
    if (tool === 'syft') {
      execSync(`syft ${projectRoot} -o cyclonedx-json=${output}`, { encoding: 'utf8', timeout: 120_000 })
    } else {
      execSync(`cyclonedx-gomod -output-file=${output}`, { encoding: 'utf8', timeout: 120_000 })
    }
    return output
  }

  async cosignSign(sbomPath: string, _opts?: { key?: string }): Promise<boolean> {
    // ponytail: cosign CLI → keyless signing when binary on PATH; stub otherwise
    if (!which('cosign')) return false
    try {
      execSync(`cosign sign --yes --tlog-upload=true ${sbomPath}`, { encoding: 'utf8', timeout: 120_000 })
      return true
    } catch {
      return false
    }
  }

  async cut(version: string, opts?: ReleaseOptions): Promise<ReleaseResult> {
    const projectRoot = opts?.projectRoot ?? this.projectRoot
    const sbomPath = await this.generateSbom({
      tool: opts?.sbomTool,
      output: `sbom-${version}.json`,
    })
    const signed = await this.cosignSign(sbomPath)
    return { version, sbom: sbomPath, signed }
  }
}

export const name = 'dsh-enterprise:dsh-release'
export const inject = [] as const

export function apply(_ctx: unknown): void {
  // no-op: dsh-release is a pure-service plugin, not a Cordis event handler
}
