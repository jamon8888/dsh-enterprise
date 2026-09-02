import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import argon2 from "argon2";
import { z } from "zod";
import { newId } from "./ids.js";

const require = createRequire(import.meta.url);
const sodium =
  require("libsodium-wrappers-sumo") as typeof import("libsodium-wrappers-sumo").default;

const ConfirmationPayloadSchema = z.object({
  userId: z.string(),
  clientId: z.string(),
  toolName: z.string(),
  argsHash: z.string(),
  summary: z.string(),
  exp: z.number().int(),
});

export type ConfirmationInput = Omit<z.infer<typeof ConfirmationPayloadSchema>, "exp"> & {
  secret: string;
  ttlMs?: number;
};

async function sodiumReady() {
  await sodium.ready;
  return sodium;
}

function masterKey(masterKeyB64: string): Uint8Array {
  const key = Buffer.from(masterKeyB64, "base64");
  if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
    throw new Error("SECRET_MASTER_KEY must decode to 32 bytes");
  }
  return key;
}

export async function seal(plaintext: string, masterKeyB64: string): Promise<string> {
  const s = await sodiumReady();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const cipher = s.crypto_secretbox_easy(plaintext, nonce, masterKey(masterKeyB64));
  return Buffer.concat([Buffer.from(nonce), Buffer.from(cipher)]).toString("base64");
}

export async function open(sealed: string, masterKeyB64: string): Promise<string> {
  const s = await sodiumReady();
  const packed = Buffer.from(sealed, "base64");
  const nonce = packed.subarray(0, s.crypto_secretbox_NONCEBYTES);
  const cipher = packed.subarray(s.crypto_secretbox_NONCEBYTES);
  const plain = s.crypto_secretbox_open_easy(cipher, nonce, masterKey(masterKeyB64));
  return Buffer.from(plain).toString("utf8");
}

export function hashKey(secret: string): Promise<string> {
  return argon2.hash(secret, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyKey(secret: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, secret);
}

/**
 * Keys carry a unique lookup prefix (`fak_<8 hex>`) so authentication is one
 * indexed row + one argon2 verify — never a scan of every key in the org.
 */
export function keyLookup(secret: string): string {
  const sep = secret.indexOf("_");
  return sep === -1 ? secret.slice(0, 12) : secret.slice(0, sep + 9);
}

export async function generateApiKey(prefix: "fak" | "fvk" | string): Promise<{
  id: string;
  secret: string;
  hash: string;
  last4: string;
  lookup: string;
}> {
  const secret = `${prefix}_${randomBytes(20).toString("hex")}`;
  return {
    id: newId(prefix === "fvk" ? "vkey" : "key"),
    secret,
    hash: await hashKey(secret),
    last4: secret.slice(-4),
    lookup: keyLookup(secret),
  };
}

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function mintConfirmation(input: ConfirmationInput): string {
  const { secret, ttlMs = 300_000, ...rest } = input;
  const body = b64url(JSON.stringify({ ...rest, exp: Date.now() + ttlMs }));
  return `${body}.${sign(secret, body)}`;
}

export function verifyConfirmation(
  token: string,
  secret: string,
): z.infer<typeof ConfirmationPayloadSchema> | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) {
    return null;
  }
  const expected = sign(secret, body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  const parsed = ConfirmationPayloadSchema.safeParse(
    JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
  );
  if (!parsed.success || parsed.data.exp < Date.now()) {
    return null;
  }
  return parsed.data;
}
