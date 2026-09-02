import { describe, it, expect } from 'vitest';
import { hashLog, tombstoneLog } from '../src/tombstone.js';

describe('GDPR tombstone', () => {
  it('chain continuity after tombstone — logHash recomputed, prevHash unchanged', () => {
    const log = [
      { seq: 1, payload: { a: 1 } },
      { seq: 2, payload: { pii: 'secret' } },
      { seq: 3, payload: { b: 2 } },
    ];
    const prevHash = 'genesis';
    const logHashBefore = hashLog(log);
    const { logPrime, tombstone } = tombstoneLog(log, 2, 'hmac-secret');
    const logHashAfter = hashLog(logPrime);
    expect(logHashBefore).not.toBe(logHashAfter);
    expect(tombstone.hmac).toMatch(/^[a-f0-9]{64}$/);
    // prevHash unchanged — chain continuity
    expect(prevHash).toBe('genesis');
    // tombstoned payload is verifiable
    expect(logPrime[1].payload._tombstoned).toBe(true);
  });
});
