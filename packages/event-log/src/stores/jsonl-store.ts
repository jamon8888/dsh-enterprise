import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventEnvelope, EventType } from '../event-types.js'

const AUDIT_CRITICAL_PREFIXES = ['guard.', 'permission.'] as const
const BUFFER_FLUSH_THRESHOLD = 64

export interface JsonlStoreOptions {
  logDir: string
  sessionId: string
}

export class JsonlStore {
  readonly filePath: string
  private buffer: string[] = []
  private flushTimer?: ReturnType<typeof setTimeout>
  private flushing = false

  constructor(private opts: JsonlStoreOptions) {
    this.filePath = join(opts.logDir, `${opts.sessionId}.jsonl`)
  }

  private isAuditCritical(eventType: EventType): boolean {
    return (AUDIT_CRITICAL_PREFIXES as readonly string[]).some((p) => eventType.startsWith(p))
  }

  async append(event: EventEnvelope): Promise<void> {
    const line = JSON.stringify(event) + '\n'
    this.buffer.push(line)
    if (this.isAuditCritical(event.eventType)) {
      await this.flush()
    } else if (this.buffer.length >= BUFFER_FLUSH_THRESHOLD) {
      await this.flush()
    }
  }

  async appendImmediate(event: EventEnvelope): Promise<void> {
    const line = JSON.stringify(event) + '\n'
    await mkdir(this.opts.logDir, { recursive: true })
    await appendFile(this.filePath, line, 'utf8')
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.flushing) return
    this.flushing = true
    try {
      await mkdir(this.opts.logDir, { recursive: true })
      await appendFile(this.filePath, this.buffer.join(''), 'utf8')
      this.buffer = []
    } finally {
      this.flushing = false
    }
  }

  scheduleFlush(intervalMs: number): void {
    if (this.flushTimer !== undefined) return
    this.flushTimer = setTimeout(async () => {
      this.flushTimer = undefined
      await this.flush()
    }, intervalMs)
  }

  stopScheduledFlush(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  async *readLines(): AsyncGenerator<string, void, unknown> {
    const { readFile } = await import('node:fs/promises')
    try {
      const content = await readFile(this.filePath, 'utf8')
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.trim()) yield line
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
  }

  async *replay(): AsyncGenerator<EventEnvelope, void, unknown> {
    for await (const line of this.readLines()) {
      try {
        yield JSON.parse(line) as EventEnvelope
      } catch {
        console.warn('[event-log] corrupt line skipped:', line.slice(0, 80))
      }
    }
  }
}
