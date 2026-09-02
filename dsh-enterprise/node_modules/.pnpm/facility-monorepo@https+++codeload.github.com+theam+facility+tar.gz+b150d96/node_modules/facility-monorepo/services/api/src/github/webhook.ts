import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGithubSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
    "utf8",
  );
  const actual = Buffer.from(signature, "utf8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function parseGithubJson(rawBody: Buffer): unknown {
  return JSON.parse(rawBody.toString("utf8")) as unknown;
}
