import { describe, it, expect } from 'vitest'
import { meter } from '../src/meter.js'

describe('otel-meter', () => {
  it('meter is exported and has createHistogram', () => {
    expect(meter).toBeDefined()
    expect(typeof meter.createHistogram).toBe('function')
  })

  it('createHistogram returns a histogram with record method', () => {
    const hist = meter.createHistogram('test.histogram', { description: 'test' })
    expect(hist).toBeDefined()
    expect(typeof hist.record).toBe('function')
  })

  it('record does not throw', () => {
    const hist = meter.createHistogram('test.record', { description: 'test' })
    expect(() => hist.record(42)).not.toThrow()
    expect(() => hist.record(42, { label: 'value' })).not.toThrow()
  })
})
