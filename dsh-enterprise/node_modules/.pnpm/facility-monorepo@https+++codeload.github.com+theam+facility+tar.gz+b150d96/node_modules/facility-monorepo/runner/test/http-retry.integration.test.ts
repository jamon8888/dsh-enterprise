import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { fetchJson, retryAfterMs } from "../src/index.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe("runner HTTP rate-limit recovery", () => {
  it("parses numeric and HTTP-date Retry-After values with a bounded fallback", () => {
    const now = Date.parse("2026-08-05T10:00:00.000Z");
    expect(retryAfterMs("4", now)).toBe(4_000);
    expect(retryAfterMs("Wed, 05 Aug 2026 10:00:03 GMT", now)).toBe(3_000);
    expect(retryAfterMs("3600", now)).toBe(60_000);
    expect(retryAfterMs("-1", now)).toBe(1_000);
    expect(retryAfterMs("0x10", now)).toBe(1_000);
    expect(retryAfterMs("1e2", now)).toBe(1_000);
    expect(retryAfterMs("invalid", now)).toBe(1_000);
    expect(retryAfterMs(null, now)).toBe(1_000);
  });

  it("creates a fresh streaming body for every upload attempt", async () => {
    const bodies: string[] = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        bodies.push(body);
        response.setHeader("content-type", "application/json");
        if (bodies.length === 1) {
          response.statusCode = 429;
          response.setHeader("retry-after", "0");
          response.end(JSON.stringify({ error: "rate_limited" }));
          return;
        }
        response.end(JSON.stringify({ uploaded: true }));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const payload = "streamed transcript\n";

    await expect(
      fetchJson(
        `http://127.0.0.1:${port}/transcript`,
        {
          method: "POST",
          headers: { "content-type": "application/x-ndjson" },
          duplex: "half",
        } as RequestInit & { duplex: "half" },
        () => Readable.from(payload) as unknown as RequestInit["body"],
      ),
    ).resolves.toEqual({ uploaded: true });
    expect(bodies).toEqual([payload, payload]);
  });

  it("replays an authenticated event batch after a deterministic 429", async () => {
    const requests: Array<{ authorization: string | undefined; body: string }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        requests.push({ authorization: request.headers.authorization, body });
        response.setHeader("content-type", "application/json");
        if (requests.length === 1) {
          response.statusCode = 429;
          response.setHeader("retry-after", "0");
          response.end(JSON.stringify({ error: "rate_limited" }));
          return;
        }
        response.end(JSON.stringify({ count: 1 }));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const payload = JSON.stringify([{ type: "shell", data: { text: "installed" } }]);

    await expect(
      fetchJson(`http://127.0.0.1:${port}/internal/runs/run_test/events`, {
        method: "POST",
        headers: {
          authorization: "Bearer runner-test-token",
          "content-type": "application/json",
        },
        body: payload,
      }),
    ).resolves.toEqual({ count: 1 });
    expect(requests).toEqual([
      { authorization: "Bearer runner-test-token", body: payload },
      { authorization: "Bearer runner-test-token", body: payload },
    ]);
  });

  it("fails closed after the bounded number of rate-limit retries", async () => {
    let attempts = 0;
    const server = createServer((_request, response) => {
      attempts += 1;
      response.statusCode = 429;
      response.setHeader("content-type", "application/json");
      response.setHeader("retry-after", "0");
      response.end(JSON.stringify({ error: "still_rate_limited" }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    await expect(fetchJson(`http://127.0.0.1:${port}/events`)).rejects.toThrow("failed 429");
    expect(attempts).toBe(9);
  });
});
