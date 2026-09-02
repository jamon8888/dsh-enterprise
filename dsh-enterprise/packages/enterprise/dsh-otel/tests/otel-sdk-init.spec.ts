import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initOtel } from '../src/sdk-init.js'

const mockStart = vi.fn()
const mockShutdown = vi.fn().mockResolvedValue(undefined)

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn(() => ({
    start: mockStart,
    shutdown: mockShutdown,
  })),
}))

describe('otel-sdk-init', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts the SDK on first call', async () => {
    const shutdown = initOtel()
    expect(mockStart).toHaveBeenCalledOnce()
    await shutdown()
  })

  it('idempotent — second call does not start again', async () => {
    const shutdown1 = initOtel()
    const shutdown2 = initOtel()
    expect(mockStart).toHaveBeenCalledOnce()
    await shutdown1()
    await shutdown2()
  })

  it('returns a shutdown function that calls sdk.shutdown', async () => {
    const shutdown = initOtel()
    expect(shutdown).toBeDefined()
    expect(typeof shutdown).toBe('function')
    await shutdown()
    expect(mockShutdown).toHaveBeenCalledOnce()
  })
})
