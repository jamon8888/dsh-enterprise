import { createObjectStore, envelopeKey, envelopeUri } from "@facility/core";
import type { EnvelopeStore, GatewayConfig } from "./types.js";

export class MemoryEnvelopeStore implements EnvelopeStore {
  readonly objects = new Map<string, unknown>();

  async putEnvelope(input: {
    orgId: string;
    requestId: string;
    payload: unknown;
    now: Date;
  }): Promise<string> {
    const key = envelopeKey(input.orgId, input.now, input.requestId);
    const uri = envelopeUri("memory", key);
    this.objects.set(uri, input.payload);
    return uri;
  }
}

export function createEnvelopeStore(config: GatewayConfig): EnvelopeStore {
  if (!config.s3Bucket) {
    return { putEnvelope: async () => null };
  }
  const store = createObjectStore(config);
  return {
    putEnvelope: ({ orgId, requestId, payload, now }) =>
      store.putObject({ orgId, requestId, payload, now }),
  };
}
