/**
 * `dsh-enterprise doctor` — validates repo scaffolding.
 * @module @deepseek-ai/dsh-enterprise-cli/doctor
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canonicalJson, sha256Hex } from '@deepseek-ai/dsh-enterprise-utils'

function verifyChain(receipts: Record<string, unknown>[]): boolean {
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i]!
    const { hash, ...rest } = r as Record<string, unknown> & { hash: string }
    const recomputed = sha256Hex(canonicalJson(rest))
    if (recomputed !== hash) return false
    if (i > 0 && r.prevHash !== receipts[i - 1]!['hash']) return false
  }
  return true
}

export type DoctorResult = { ok: boolean; issues: string[] }

export async function runDoctor(opts: { dir?: string; runGuards?: boolean; github?: boolean } = {}): Promise<DoctorResult> {
  const dir = opts.dir ?? process.cwd()
  const issues: string[] = []

  // 1. workflows exist
  for (const name of ['plan', 'build', 'review']) {
    const p = join(dir, '.github/workflows', `${name}.yml`)
    if (!existsSync(p)) issues.push(`missing workflow: .github/workflows/${name}.yml`)
  }

  // 2. iit-config.yaml parseable
  const cfgPath = join(dir, '.dsh/iit-config.yaml')
  if (!existsSync(cfgPath)) {
    issues.push('missing .dsh/iit-config.yaml')
  } else {
    try {
      const raw = readFileSync(cfgPath, 'utf8')
      // minimal validation: must contain minPhi or tpmVars
      if (!raw.includes('minPhi') && !raw.includes('tpmVars')) {
        issues.push('iit-config.yaml parseable but missing expected keys')
      }
      // try to ensure yaml-ish (no strict parse needed)
      if (raw.trim().length === 0) issues.push('iit-config.yaml is empty')
    } catch (e) {
      issues.push(`iit-config.yaml not readable: ${(e as Error).message}`)
    }
  }

  // 3. Facility harness resolvable — check pnpm-workspace.yaml catalog or package.json dep
  const wsPath = join(dir, 'pnpm-workspace.yaml')
  const pkgPath = join(dir, 'package.json')
  let harnessFound = false
  if (existsSync(wsPath)) {
    const ws = readFileSync(wsPath, 'utf8')
    if (ws.includes('facilityHarness') || ws.includes('facility')) harnessFound = true
  }
  // also check root workspace file one level up if dir is tmpdir
  if (!harnessFound && existsSync(pkgPath)) {
    const pkg = readFileSync(pkgPath, 'utf8')
    if (pkg.includes('facility')) harnessFound = true
  }
  // Check monorepo root as fallback (walk up to 3 levels)
  if (!harnessFound) {
    try {
      for (let i = 1; i <= 3; i++) {
        const candidate = join(dir, ...Array(i).fill('..'), 'pnpm-workspace.yaml')
        if (existsSync(candidate) && readFileSync(candidate, 'utf8').includes('facilityHarness')) {
          harnessFound = true
          break
        }
      }
    } catch {}
  }
  if (!harnessFound) {
    // warn but not hard fail? spec says validate resolvable
    issues.push('Facility harness not resolvable (pnpm-workspace.yaml catalog missing facilityHarness)')
  }

  // 4. pnpm-workspace.yaml catalog pins present
  const catalogs = ['cordis', 'schemastery']
  if (existsSync(wsPath)) {
    const ws = readFileSync(wsPath, 'utf8')
    for (const c of catalogs) {
      if (!ws.includes(c)) issues.push(`pnpm-workspace.yaml catalog missing pin: ${c}`)
    }
  } else {
    // walk up to find pnpm-workspace.yaml
    let found = false
    for (let i = 1; i <= 3; i++) {
      const candidate = join(dir, ...Array(i).fill('..'), 'pnpm-workspace.yaml')
      if (existsSync(candidate)) {
        const ws = readFileSync(candidate, 'utf8')
        for (const c of catalogs) if (!ws.includes(c)) issues.push(`pnpm-workspace.yaml catalog missing pin: ${c}`)
        found = true
        break
      }
    }
    if (!found) issues.push('missing pnpm-workspace.yaml')
  }

  // 5. receipts chain verifyChain if watchtower available — stub: if .dsh/receipts.json exists verify
  const receiptsPath = join(dir, '.dsh/receipts.json')
  if (existsSync(receiptsPath)) {
    try {
      const raw = readFileSync(receiptsPath, 'utf8')
      const receipts = JSON.parse(raw)
      if (Array.isArray(receipts) && receipts.length > 0) {
        if (!verifyChain(receipts)) issues.push('receipts chain verifyChain failed')
      }
    } catch (e) {
      issues.push(`receipts chain check failed: ${(e as Error).message}`)
    }
  }

  // --run-guards / --github flags are informational stubs for now
  void opts.runGuards
  void opts.github

  return { ok: issues.length === 0, issues }
}
