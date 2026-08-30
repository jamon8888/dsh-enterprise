/**
 * Package invariant — asserts S→D→T→V linking discipline for MCP chain tools.
 * @module @deepseek-ai/dsh-enterprise-mcp/invariant
 */

export const name = 'mcp-invariant'
export const inject = ['invariants'] as const

import { PARENT_REQUIRED } from './tools/chains.js'

const PACKAGE_NAME = '@deepseek-ai/dsh-enterprise-mcp'

type InvariantInstaller = (ctx: unknown, fail: (msg: string) => never) => void

const install: InvariantInstaller = (_ctx, fail) => {
  const expect = (prefix: string, parents: string[]) => {
    const got = PARENT_REQUIRED[prefix]
    if (!got || got.length !== parents.length || !got.every((p, i) => p === parents[i])) {
      fail(`mcp PARENT_REQUIRED ${prefix} expected [${parents.join(',')}] got [${(got ?? []).join(',')}]`)
    }
  }
  expect('S', [])
  expect('D', ['S'])
  expect('T', ['D'])
  expect('V', ['T'])
}

export const apply = (ctx: unknown): Promise<() => void> =>
  Promise.resolve(
    (ctx as unknown as { invariants: { register: (pkg: string, fn: InvariantInstaller) => () => void } }).invariants.register(
      PACKAGE_NAME,
      Object.assign(install, { inject }),
    ),
  )
