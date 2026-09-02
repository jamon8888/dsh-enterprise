declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }
  export interface Database {
    run(sql: string, params?: unknown[]): void
    exec(sql: string, params?: unknown[]): QueryExecResult[]
    export(): Uint8Array
    close(): void
  }
  export interface QueryExecResult {
    columns: string[]
    values: (string | number | Uint8Array | null)[][]
  }
  export interface SqlJsOptions {
    locateFile?: (file: string) => string
  }
  export default function initSqlJs(options?: SqlJsOptions): Promise<SqlJsStatic>
}
