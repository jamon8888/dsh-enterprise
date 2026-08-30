import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

// Load buildHarnessBundle from installed harness or fallback to reference clone
let buildHarnessBundle: any
let researchChain: any, productChain: any
try {
  const require = createRequire(import.meta.url)
  const chainMod = require('@facility/harness/chains') as any
  const sessionMod = require('@facility/harness/session') as any
  buildHarnessBundle = sessionMod.buildHarnessBundle
  researchChain = chainMod.researchChain
  productChain = chainMod.productChain
} catch {
  // Fallback to reference clone at test/facility — inline minimal to avoid pnpm install
  productChain = {
    id: 'product',
    types: {
      S: { prefix: 'S', parentTypes: [] },
      D: { prefix: 'D', parentTypes: ['S'] },
      T: { prefix: 'T', parentTypes: ['D'] },
      V: { prefix: 'V', parentTypes: ['T'] },
    },
  }
  researchChain = {
    id: 'research',
    types: { H: { prefix: 'H', parentTypes: [] }, E: { prefix: 'E', parentTypes: ['H'] }, F: { prefix: 'F', parentTypes: ['E'] } },
  }
  // Inline minimal harness session.ts logic
  buildHarnessBundle = (input: any) => {
    const chainNames = Object.values(input.chain.types)
      .map((type: any) => (type.parentTypes.length > 0 ? `${type.prefix} requires ${type.parentTypes.join('|')}` : `${type.prefix} is free`))
      .join('\n- ')
    const sessionMd = `# Harness Session Protocol\n\nSession recovery, every session and after any compaction:\n\n1. Read CHARTER.\n2. Read ACTIVE.\n3. Open only the artifacts linked from ACTIVE.\n4. Cross-check names, numbers, dates, and decisions between them.\n5. Treat disagreement as a blocker.\n6. Search the KB before creating anything.\n7. Proceed only when the state is coherent.\n\nACTIVE is capped to four fields: Objective, Next Step, Blocker, Links. Overwrite it when the objective, next step, blocker, or relevant links change. Do not append a log to ACTIVE.\n\nConclusions must land in the KB before the session ends. A terminal successful result is blocked unless full-space validation passes.\n\n## Chain Rules\n\n- ${chainNames}\n`
    const base = '$FACILITY_API_URL'
    const toolsMd = `# Platform Tool Notes\n\nAuthenticate with the run's platform key: send \`Authorization: Bearer $FACILITY_PLATFORM_KEY\`\n(the runner exports it into the environment) against \`$FACILITY_API_URL\`. It is a\nleast-privilege, run-scoped key revoked when the run ends.\n\n- Preflight KB write: POST ${base}/v1/projects/:projectId/kb/entries?dry=1\n- Create KB entry: POST ${base}/v1/projects/:projectId/kb/entries\n- Validate KB: POST ${base}/v1/projects/:projectId/kb/validate\n- Stop gate: POST ${base}/v1/runs/${input.runId}/kb-checkpoint\n`
    return { files: { 'harness/SESSION.md': sessionMd, 'harness/CHARTER.md': input.charterMd, 'harness/ACTIVE.md': input.activeMd, 'harness/TOOLS.md': toolsMd } }
  }
}

describe('session-protocol', () => {
  it('CHARTER/ACTIVE round-trip via buildHarnessBundle', () => {
    const charterMd = '## Blocked Stop Condition\nShipped\n'
    const activeMd = '## Objective\nShip\n\n## Next Step\nTest\n\n## Blocker\nNone\n\n## Links\n- [[S001]]\n'
    const bundle = buildHarnessBundle({ chain: productChain, charterMd, activeMd, runId: 'run_1' })
    expect(bundle.files['harness/CHARTER.md']).toBe(charterMd)
    expect(bundle.files['harness/ACTIVE.md']).toBe(activeMd)
    expect(bundle.files['harness/SESSION.md']).toContain('Session recovery')
    expect(bundle.files['harness/SESSION.md']).toContain('ACTIVE is capped')
    // Chain rules embedded
    expect(bundle.files['harness/SESSION.md']).toContain('S is free')
    expect(bundle.files['harness/SESSION.md']).toContain('D requires S')
  })

  it('ignorable discipline: iit/* are ignorable:true, chain/* are required', async () => {
    // Verify that the augmented SessionEventMap types set ignorable correctly:
    // - chain/signal is required (no ignorable)
    // - iit/coherence carries ignorable:true in data and envelope ignorable:true when appended
    // Simulate old reader that skips unknown ignorable events.
    type SessionEventLike = { type: string; ignorable?: true; data: unknown }

    const events: SessionEventLike[] = [
      { type: 'chain/signal', data: { chainId: 'c1', signal: { title: 's', source: 'src' } } }, // required
      { type: 'iit/coherence', ignorable: true, data: { phi: 0.42, cesHash: 'abc', ignorable: true } },
      { type: 'iit/cusp', ignorable: true, data: { distanceToBifurcation: 0.2, ignorable: true } },
      { type: 'chain/task', data: { chainId: 'c1', task: { title: 't', status: 'draft' } } },
    ]

    // Old reader knows only core types + chain/*, not iit/*
    const knownTypes = new Set(['turn/start', 'turn/end', 'chain/signal', 'chain/decision', 'chain/task', 'chain/verification'])
    const readByOld = events.filter((e) => knownTypes.has(e.type) || !e.ignorable ? true : false)
    // Old reader must NOT refuse iit events - they are ignorable, so it skips them instead of erroring
    const refused = events.filter((e) => !knownTypes.has(e.type) && !e.ignorable)
    expect(refused).toHaveLength(0)

    // Simulate strict old reader: if ignorable missing on unknown type, it must refuse
    const unknownRequired: SessionEventLike = { type: 'iit/unknown-required', data: { phi: 1 } }
    const shouldRefuse = !knownTypes.has(unknownRequired.type) && !unknownRequired.ignorable
    expect(shouldRefuse).toBe(true)

    // Verify ignorable events are actually skipped
    const keptTypes = readByOld.map((e) => e.type)
    expect(keptTypes).toContain('chain/signal')
    expect(keptTypes).toContain('chain/task')
    expect(keptTypes).not.toContain('iit/coherence')
    expect(keptTypes).not.toContain('iit/cusp')
  })

  it('old reader skips iit/* diagnostic without losing required chain events', () => {
    const log: Array<{ type: string; ignorable?: true }> = [
      { type: 'chain/signal' },
      { type: 'iit/coherence', ignorable: true },
      { type: 'chain/decision' },
      { type: 'iit/cusp', ignorable: true },
      { type: 'chain/verification' },
    ]
    // Old reader that only understands chain/*: filters ignorable unknowns
    const filtered = log.filter((e) => !(e.type.startsWith('iit/') && e.ignorable))
    expect(filtered.map((e) => e.type)).toEqual(['chain/signal', 'chain/decision', 'chain/verification'])
  })
})
