import type { FastifyReply } from "fastify";
import type { Provider } from "./types.js";

export class GatewayError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public provider: Provider,
  ) {
    super(message);
  }
}

export function providerEnvelope(provider: Provider, code: string, message: string) {
  if (provider === "anthropic") {
    return { type: "error", error: { type: code, message } };
  }
  return { error: { type: code, code, message } };
}

export function sendProviderError(reply: FastifyReply, error: GatewayError) {
  return reply
    .status(error.statusCode)
    .type("application/json")
    .send(providerEnvelope(error.provider, error.code, error.message));
}
