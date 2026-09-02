import { createHmac, createHash } from 'node:crypto';
import { canonicalJson } from '@deepseek-ai/dsh-enterprise-utils';

export interface Tombstone {
  targetEventSeq: number;
  redactedHash: string;
  reason: string;
  requestedBy: string;
  hmac: string;
}

export function hashLog(log: unknown[]): string {
  return createHash('sha256').update(canonicalJson(log)).digest('hex');
}

export function tombstoneLog(log: any[], seq: number, secret: string): { logPrime: any[]; tombstone: Tombstone } {
  const idx = log.findIndex((e) => e.seq === seq);
  if (idx === -1) throw new Error(`seq ${seq} not found`);
  const redactedHash = createHash('sha256').update(canonicalJson(log[idx].payload)).digest('hex');
  const hmac = createHmac('sha256', secret).update(redactedHash).digest('hex');
  const tombstone: Tombstone = { targetEventSeq: seq, redactedHash, reason: 'GDPR Art.17', requestedBy: 'dpo', hmac };
  const logPrime = log.map((e) => (e.seq === seq ? { ...e, payload: { _tombstoned: true, hmac }, redacted: true } : e));
  return { logPrime, tombstone };
}

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'erasure/tombstone': Tombstone;
  }
}
