import { Readable } from "node:stream";

const MAX_BODY_BYTES = 20 * 1024 * 1024;

export async function readJsonBody(body: unknown): Promise<{ raw: Buffer; json: unknown }> {
  const chunks: Buffer[] = [];
  let size = 0;
  const stream = body instanceof Readable ? body : Readable.from(body ? [body] : []);
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("request body exceeds 20MB");
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks);
  return { raw, json: raw.length === 0 ? {} : JSON.parse(raw.toString("utf8")) };
}

export function modelFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const model = (body as { model?: unknown }).model;
  return typeof model === "string" ? model : null;
}

export function prepareOpenAiBody(
  body: unknown,
  options: { injectChatStreamUsage?: boolean } = {},
): { raw: Buffer; recordedBody: unknown } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { raw: Buffer.from(JSON.stringify(body ?? {})), recordedBody: body ?? {} };
  }
  const input = body as Record<string, unknown>;
  const recorded = structuredClone(input);
  if (input.stream !== true || options.injectChatStreamUsage === false) {
    return { raw: Buffer.from(JSON.stringify(input)), recordedBody: recorded };
  }
  const streamOptions =
    input.stream_options &&
    typeof input.stream_options === "object" &&
    !Array.isArray(input.stream_options)
      ? { ...(input.stream_options as Record<string, unknown>) }
      : {};
  if (streamOptions.include_usage === true) {
    return { raw: Buffer.from(JSON.stringify(input)), recordedBody: recorded };
  }
  const upstream = { ...input, stream_options: { ...streamOptions, include_usage: true } };
  return { raw: Buffer.from(JSON.stringify(upstream)), recordedBody: recorded };
}

export function sanitizedRequest(body: unknown, headers: Record<string, unknown>) {
  return {
    headers: {
      authorization: headers.authorization ? "Bearer REDACTED" : undefined,
      "x-api-key": headers["x-api-key"] ? "REDACTED" : undefined,
      "anthropic-version": headers["anthropic-version"],
      "content-type": headers["content-type"],
    },
    body,
  };
}
