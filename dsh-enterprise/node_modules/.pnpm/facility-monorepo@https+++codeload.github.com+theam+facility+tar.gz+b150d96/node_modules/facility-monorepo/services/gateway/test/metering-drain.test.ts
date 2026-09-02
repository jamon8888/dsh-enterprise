import { describe, expect, it } from "vitest";
import { createMeteringDrain } from "../src/app.js";

describe("metering drain", () => {
  it("waits for work registered while a drain is already in progress", async () => {
    const drain = createMeteringDrain();
    const first = deferred<void>();
    const second = deferred<void>();
    const firstTracked = drain.track(first.promise);
    let settled = false;
    const settling = drain.settled().then(() => {
      settled = true;
    });

    const secondTracked = drain.track(second.promise);
    first.resolve();
    await firstTracked;
    await Promise.resolve();
    expect(settled).toBe(false);

    second.resolve();
    await Promise.all([secondTracked, settling]);
    expect(settled).toBe(true);
  });

  it("settles rejected work without hiding the rejection from its caller", async () => {
    const drain = createMeteringDrain();
    const work = deferred<void>();
    const failure = new Error("metering failed");
    const tracked = drain.track(work.promise);
    const trackedRejection = tracked.catch((error: unknown) => error);
    const settling = drain.settled();

    work.reject(failure);

    await expect(settling).resolves.toBeUndefined();
    expect(await trackedRejection).toBe(failure);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
