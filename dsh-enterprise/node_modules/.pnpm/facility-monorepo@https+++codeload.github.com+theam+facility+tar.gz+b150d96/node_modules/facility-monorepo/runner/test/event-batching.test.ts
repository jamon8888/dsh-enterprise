import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { drainLineEvents } from "../src/index.js";
import type { RunEvent } from "../src/types.js";

describe("runner lifecycle event batching", () => {
  it("batches noisy command output while preserving every line in order", async () => {
    const stream = new PassThrough();
    const deliveries: RunEvent[][] = [];
    const draining = drainLineEvents(
      stream,
      "shell",
      async (events) => {
        deliveries.push(events);
      },
      { batchSize: 25, flushMs: 1_000 },
    );
    const expected = Array.from({ length: 60 }, (_, index) => `line-${index}`);

    stream.end(`${expected.join("\n")}\n`);
    await draining;

    expect(deliveries.map((events) => events.length)).toEqual([25, 25, 10]);
    expect(deliveries.flatMap((events) => events.map((event) => event.data?.text))).toEqual(
      expected,
    );
  });

  it("flushes sparse output without waiting for the process to exit", async () => {
    const stream = new PassThrough();
    let resolveFirstDelivery: (() => void) | undefined;
    const firstDelivery = new Promise<void>((resolve) => {
      resolveFirstDelivery = resolve;
    });
    const deliveries: RunEvent[][] = [];
    const draining = drainLineEvents(
      stream,
      "assistant",
      async (events) => {
        deliveries.push(events);
        resolveFirstDelivery?.();
      },
      { batchSize: 25, flushMs: 10 },
    );

    stream.write("working\n");
    await expect(
      Promise.race([
        firstDelivery.then(() => "delivered"),
        new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 500)),
      ]),
    ).resolves.toBe("delivered");
    expect(deliveries).toEqual([[{ type: "assistant", data: { text: "working" } }]]);

    stream.end();
    await draining;
  });

  it("compacts transient container-layer progress but preserves useful shell output", async () => {
    const stream = new PassThrough();
    const deliveries: RunEvent[][] = [];
    const draining = drainLineEvents(stream, "shell", async (events) => {
      deliveries.push(events);
    });

    stream.end(
      `${[
        "studio Pulling",
        "5592d1f29924 Pulling fs layer",
        "5592d1f29924 Downloading 12.4MB",
        "5592d1f29924 Extracting 13 s",
        "5592d1f29924 Pull complete",
        "studio Pulled",
        "healthy and ready",
      ].join("\n")}\n`,
    );
    await draining;

    expect(deliveries.flatMap((events) => events.map((event) => event.data?.text))).toEqual([
      "studio Pulling",
      "studio Pulled",
      "healthy and ready",
      "[Facility] Suppressed 4 transient container download progress lines",
    ]);
  });

  it("coalesces one bounded pending batch while delivery is blocked", async () => {
    const stream = new PassThrough();
    let resolveBlockedDelivery: (() => void) | undefined;
    const blockedDelivery = new Promise<void>((resolve) => {
      resolveBlockedDelivery = resolve;
    });
    let resolveDeliveryStarted: (() => void) | undefined;
    const deliveryStarted = new Promise<void>((resolve) => {
      resolveDeliveryStarted = resolve;
    });
    const deliveries: RunEvent[][] = [];
    const draining = drainLineEvents(
      stream,
      "shell",
      async (events) => {
        deliveries.push(events);
        if (deliveries.length === 1) {
          resolveDeliveryStarted?.();
          await blockedDelivery;
        }
      },
      { batchSize: 5, flushMs: 5 },
    );

    stream.write("line-0\n");
    await deliveryStarted;
    for (let index = 1; index < 11; index += 1) {
      stream.write(`line-${index}\n`);
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    resolveBlockedDelivery?.();
    stream.end();
    await draining;

    expect(deliveries.map((events) => events.length)).toEqual([1, 5, 5]);
    expect(deliveries.flatMap((events) => events.map((event) => event.data?.text))).toEqual(
      Array.from({ length: 11 }, (_, index) => `line-${index}`),
    );
  });

  it("splits long lines before a serialized batch reaches the request budget", async () => {
    const stream = new PassThrough();
    const deliveries: RunEvent[][] = [];
    const draining = drainLineEvents(stream, "shell", async (events) => {
      deliveries.push(events);
    });
    const line = "x".repeat(21 * 1024);

    stream.end(`${Array.from({ length: 50 }, () => line).join("\n")}\n`);
    await draining;

    expect(deliveries.length).toBeGreaterThan(1);
    expect(deliveries.flat()).toHaveLength(50);
    for (const events of deliveries) {
      expect(Buffer.byteLength(JSON.stringify(events))).toBeLessThanOrEqual(900 * 1024);
    }
  });

  it("propagates a failed batch delivery", async () => {
    const stream = new PassThrough();
    const draining = drainLineEvents(stream, "shell", async () => {
      throw new Error("delivery_failed");
    });

    stream.end("line\n");
    await expect(draining).rejects.toThrow("delivery_failed");
  });

  it("propagates a failed delivery while the source stream remains open", async () => {
    const stream = new PassThrough();
    let rejectDelivery: ((error: Error) => void) | undefined;
    const delivery = new Promise<void>((_resolve, reject) => {
      rejectDelivery = reject;
    });
    let resolveDeliveryStarted: (() => void) | undefined;
    const deliveryStarted = new Promise<void>((resolve) => {
      resolveDeliveryStarted = resolve;
    });
    const draining = drainLineEvents(
      stream,
      "shell",
      async () => {
        resolveDeliveryStarted?.();
        await delivery;
      },
      { batchSize: 5, flushMs: 5 },
    );

    stream.write("line\n");
    await deliveryStarted;
    rejectDelivery?.(new Error("delivery_failed_while_open"));

    await expect(draining).rejects.toThrow("delivery_failed_while_open");
    stream.destroy();
  });
});
