import { createHmac, timingSafeEqual } from "node:crypto";

function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signedBundleToken(runId: string, secret: string, ttlMs = 5 * 60_000): string {
  const exp = Date.now() + ttlMs;
  const body = Buffer.from(JSON.stringify({ runId, exp })).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

export function verifyBundleToken(token: string, runId: string, secret: string): boolean {
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const expected = sign(secret, body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      runId?: string;
      exp?: number;
    };
    return parsed.runId === runId && typeof parsed.exp === "number" && parsed.exp >= Date.now();
  } catch {
    return false;
  }
}
