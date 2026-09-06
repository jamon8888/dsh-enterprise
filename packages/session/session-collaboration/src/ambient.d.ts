/**
 * Ambient declarations for untyped third-party deps used by session/* and identity/*.
 *
 * These packages predate the @deepseek-ai/* scope (bare `cordis` / `schemastery`
 * imports) and use runtime-mocked (pg / ioredis / yjs / y-websocket) or missing
 * (@deepseek-ai/dsh-session-persistence) modules. Runtime works (mocks + type
 * erasure); only tsc needs these shapes.
 *
 * ponytail: ambient `any` instead of real type deps. Replace with typed imports
 * when these packages migrate to the estate stack (catalog @deepseek-ai/cordis,
 * real pg/ioredis/yjs type deps in pnpm workspace).
 */
declare module 'cordis' {
  export type Context = any
  export type Service = any
  export type Plugin = any
  const cordis: any
  export default cordis
}
declare module 'schemastery' {
  export const z: any
  export const Schema: any
  const schemastery: any
  export default schemastery
}
declare module 'pg' {
  export interface PoolClient {
    query<T = any>(...args: any[]): any
    release(...args: any[]): any
    [k: string]: any
  }
  export interface Pool {
    query<T = any>(...args: any[]): any
    connect(...args: any[]): PoolClient
    end(...args: any[]): any
    [k: string]: any
  }
  export interface QueryResult<T = any> {
    rows: T[]
    [k: string]: any
  }
  export const Pool: any
  const pg: any
  export default pg
}
declare module 'pg-copy-streams' {
  export const copyFrom: any
  const streams: any
  export default streams
}
declare module 'ioredis' {
  class Redis {
    constructor(...args: any[])
    [k: string]: any
  }
  export default Redis
}
declare module 'yjs' {
  export namespace Y {
    class Doc {
      [k: string]: any
    }
  }
}
declare module 'y-websocket' {
  export const WebsocketProvider: any
}
declare module '@deepseek-ai/dsh-session-persistence' {
  export const PersistenceCoordinator: any
}
