import { describe, expect, it } from "vitest";
import { readEnvelopeObject } from "../src/envelopes.js";
import type { AppConfig } from "../src/types.js";

// Only s3Bucket is read before the org-prefix guard fires (no network call), so a
// partial config is enough to exercise the security-relevant path.
const config = { s3Bucket: "facility-test" } as unknown as AppConfig;

describe("readEnvelopeObject org binding", () => {
  it("refuses a same-bucket URI outside the caller's org envelope prefix", async () => {
    const foreign = "s3://facility-test/envelopes/org_intruder/2026-01/req_1.json.gz";
    await expect(readEnvelopeObject(config, foreign, "org_me")).rejects.toMatchObject({
      statusCode: 404,
      code: "envelope_not_found",
    });
  });

  it("treats a missing URI as not found", async () => {
    await expect(readEnvelopeObject(config, null, "org_me")).rejects.toMatchObject({
      statusCode: 404,
      code: "envelope_not_found",
    });
  });
});
