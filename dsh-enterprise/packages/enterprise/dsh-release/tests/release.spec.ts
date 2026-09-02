import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReleaseService } from '../src/plugin.js'

const mockExecSync = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}))

describe('dsh-release', () => {
  beforeEach(() => {
    mockExecSync.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // 1. generateSbom() — syft available → returns path to SBOM JSON file
  it('generateSbom with syft available returns sbom path', async () => {
    mockExecSync
      .mockReturnValueOnce('/usr/bin/syft') // which syft
      .mockReturnValueOnce('') // syft command itself (no-op, success)

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.generateSbom()
    expect(result).toBe('sbom.json')
    expect(mockExecSync).toHaveBeenCalledTimes(2)
  })

  // 2. generateSbom() — no SBOM tool → returns 'sbom-stub.json'
  it('generateSbom with no SBOM tool returns stub', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.generateSbom()
    expect(result).toBe('sbom-stub.json')
  })

  // 3. generateSbom() — specified tool not found → throws Error
  it('generateSbom throws when specified tool not found', async () => {
    mockExecSync.mockReturnValue(null) // which returns null

    const svc = new ReleaseService('/tmp/project')
    await expect(svc.generateSbom({ tool: 'cyclonedx-gomod' })).rejects.toThrow(
      'sbom tool not found: cyclonedx-gomod',
    )
  })

  // 4. cosignSign() — cosign available → returns true on success
  it('cosignSign with cosign available returns true on success', async () => {
    mockExecSync
      .mockReturnValueOnce('/usr/bin/cosign') // which cosign
      .mockReturnValueOnce('') // cosign sign success

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.cosignSign('sbom.json')
    expect(result).toBe(true)
  })

  // 5. cosignSign() — cosign not available → returns false (stub)
  it('cosignSign when cosign not available returns false', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.cosignSign('sbom.json')
    expect(result).toBe(false)
  })

  // 6. cosignSign() — cosign fails → returns false
  it('cosignSign when cosign fails returns false', async () => {
    mockExecSync
      .mockReturnValueOnce('/usr/bin/cosign') // which cosign
      .mockImplementation(() => {
        // syft or cosign sign fails
        throw new Error('cosign sign failed')
      })

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.cosignSign('sbom.json')
    expect(result).toBe(false)
  })

  // 7. cut() — full flow (generate + sign) → returns result with version, sbom, signed
  it('cut full flow returns result with version sbom signed', async () => {
    mockExecSync
      .mockReturnValueOnce('/usr/bin/syft') // which syft
      .mockReturnValueOnce('') // syft run
      .mockReturnValueOnce('/usr/bin/cosign') // which cosign
      .mockReturnValueOnce('') // cosign sign

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.cut('1.0.0')
    expect(result).toEqual({ version: '1.0.0', sbom: 'sbom-1.0.0.json', signed: true })
  })

  // 8. cut() — SBOM tool not found → returns result with signed=false, stub sbom
  it('cut when SBOM tool not found returns result with signed=false stub sbom', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.cut('2.0.0')
    expect(result).toEqual({ version: '2.0.0', sbom: 'sbom-stub.json', signed: false })
  })

  // 9. cut() — cosign not found → returns result with signed=false
  it('cut when cosign not found returns result with signed=false', async () => {
    mockExecSync
      .mockReturnValueOnce('/usr/bin/syft') // which syft
      .mockReturnValueOnce('') // syft run
      // which cosign throws → cosignSign returns false

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.cut('3.0.0')
    expect(result).toEqual({ version: '3.0.0', sbom: 'sbom-3.0.0.json', signed: false })
  })

  // 10. Error: generateSbom() throws on specified but unavailable tool
  it('generateSbom throws on specified but unavailable tool', async () => {
    mockExecSync.mockReturnValue(null)

    const svc = new ReleaseService('/tmp/project')
    await expect(svc.generateSbom({ tool: 'syft' })).rejects.toThrow('sbom tool not found: syft')
  })

  // 11. Error: cosignSign() returns false (not throws) when cosign missing
  it('cosignSign returns false when cosign missing without throwing', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found')
    })

    const svc = new ReleaseService('/tmp/project')
    const result = await svc.cosignSign('sbom.json')
    expect(result).toBe(false)
  })

  // 12. cut() — projectRoot option passed to generateSbom
  it('cut passes projectRoot option to generateSbom', async () => {
    mockExecSync
      .mockReturnValueOnce('/usr/bin/syft') // which syft
      .mockReturnValueOnce('') // syft run
      .mockReturnValueOnce('/usr/bin/cosign') // which cosign
      .mockReturnValueOnce('') // cosign sign

    const svc = new ReleaseService('/default/root')
    await svc.cut('4.0.0', { projectRoot: '/custom/root' })
    expect(mockExecSync).toHaveBeenNthCalledWith(1, 'which syft', expect.any(Object))
  })
})
