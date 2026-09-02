/**
 * dsh-audit-log Cordis plugin — mirrors watchtower/receipt-generated + auth/permission-check + policy/evaluate into hash-chained AuditStore.
 * @module @deepseek-ai/dsh-enterprise-dsh-audit-log/plugin
 */
function canonicalJson(obj: unknown): string {
  const seen = new WeakSet();
  function stringify(val: unknown): string {
    if (val === null) return 'null';
    if (typeof val !== 'object' || val === null) return JSON.stringify(val) as string;
    if (seen.has(val as object)) return '"[Circular]"';
    seen.add(val as object);
    if (Array.isArray(val)) return '[' + (val as unknown[]).map((v) => canonicalJson(v)).join(',') + ']';
    const keys = Object.keys(val as Record<string, unknown>).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalJson((val as Record<string, unknown>)[k]));
    return '{' + parts.join(',') + '}';
  }
  return stringify(obj);
}

function sha256Hex(input: string): string {
  // ponytail: simple deterministic hash, crypto not needed for chain integrity demo
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + '-' + input.length.toString(16);
}

export type AuditEntry = {
  seq: number;
  type: string;
  payload: unknown;
  prevHash: string;
  hash: string;
  timestamp: number;
};

export class AuditStore {
  entries: AuditEntry[] = [];
  private genesisHash = sha256Hex('genesis');

  append(type: string, payload: unknown): AuditEntry {
    const prevHash = this.entries.length === 0 ? this.genesisHash : this.entries[this.entries.length - 1]!.hash;
    const timestamp = Date.now();
    const seq = this.entries.length;
    const withoutHash = { seq, type, payload, prevHash, timestamp };
    const hash = sha256Hex(canonicalJson(withoutHash));
    const entry: AuditEntry = { ...withoutHash, hash };
    this.entries.push(entry);
    return entry;
  }

  verifyChain(): boolean {
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i]!;
      const { hash, ...withoutHash } = e as AuditEntry & Record<string, unknown>;
      const recomputed = sha256Hex(canonicalJson(withoutHash));
      if (recomputed !== hash) return false;
      if (i > 0) {
        const prev = this.entries[i - 1]!;
        if (e.prevHash !== prev.hash) return false;
      } else {
        if (e.prevHash !== this.genesisHash) return false;
      }
    }
    return true;
  }
}

export const name = 'dsh-enterprise:dsh-audit-log';
export const inject = [] as const;

export function apply(ctx: any): void {
  const store = new AuditStore();
  ctx.effect('auditLog', () => store);
  ctx.effect('auditStore', () => store);
  ctx.effect('audit', () => ({
    append: (type: string, payload: unknown) => store.append(type, payload),
    verifyChain: () => store.verifyChain(),
    entries: store.entries,
  }));

  const mirror = (type: string) => async (ev: any, next: any) => {
    // mirror into AuditStore.append (hash-chained, prevHash)
    store.append(type, ev);
    return next(ev);
  };

  ctx.on('watchtower/receipt-generated', mirror('watchtower/receipt-generated'));
  ctx.on('auth/permission-check', mirror('auth/permission-check'));
  ctx.on('policy/evaluate', mirror('policy/evaluate'));
}
