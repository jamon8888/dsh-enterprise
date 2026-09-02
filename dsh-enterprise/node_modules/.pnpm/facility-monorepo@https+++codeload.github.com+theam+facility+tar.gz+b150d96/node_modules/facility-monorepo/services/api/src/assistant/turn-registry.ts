import { randomUUID } from "node:crypto";

/**
 * In-process registry binding a live assistant turn (runId) to a secret that
 * never crosses the wire to any client: the loop and the route handlers share
 * one process (app.inject), so possession of the matching token proves a
 * request originates from the assistant loop itself. This is the basis for
 * recording the AGENT as a proposal's requester — the human stays a distinct
 * approver by construction (dual control = "human distinct from the proposing
 * agent").
 */
const tokens = new Map<string, string>();

export function registerAssistantTurn(runId: string): string {
  const token = randomUUID();
  tokens.set(runId, token);
  return token;
}

export function releaseAssistantTurn(runId: string): void {
  tokens.delete(runId);
}

export function verifyAssistantTurn(runId: string, token: string): boolean {
  const expected = tokens.get(runId);
  return expected !== undefined && expected === token;
}
