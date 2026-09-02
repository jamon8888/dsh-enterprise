import { describe, expect, it } from "vitest";
import { type VercelSandboxClient, VercelSandboxDriver } from "../src/sandbox/vercel.js";

describe("Vercel sandbox provider integration", () => {
  it("keeps lifecycle operations inside the configured Vercel project", async () => {
    const provider = new InMemoryVercelProvider("valid-token");
    const projectA = new VercelSandboxDriver(provider, providerEnv("project-a"));
    const projectB = new VercelSandboxDriver(provider, providerEnv("project-b"));

    const launched = await projectA.launch({
      runId: "run_integration",
      kind: "run",
      image: "runner:integration",
      env: { FACILITY_API_URL: "https://api.facility.example" },
      cpu: 2,
      memoryMb: 4096,
      timeoutMin: 15,
      network: { egress: "restricted" },
    });
    await expect(projectA.status(launched.ref)).resolves.toBe("running");

    provider.onlySandbox().command.entries.push({ data: "runner ready\nreceipt sent\n" });
    const logs: string[] = [];
    for await (const line of projectA.logs(launched.ref)) logs.push(line);
    expect(logs).toEqual(["runner ready", "receipt sent"]);

    // A valid ref is not authority: the exact configured team/project binding
    // still scopes every provider lookup and prevents cross-project control.
    await expect(projectB.status(launched.ref)).resolves.toBe("lost");
    await expect(projectB.destroy(launched.ref)).resolves.toBeUndefined();
    expect(provider.onlySandbox().deleted).toBe(false);

    await projectA.stop(launched.ref);
    expect(provider.onlySandbox().command.signal).toBe("SIGTERM");
    await projectA.destroy(launched.ref);
    expect(provider.onlySandbox().deleted).toBe(true);
  });

  it("does not contact a project when the provider credential is rejected", async () => {
    const provider = new InMemoryVercelProvider("valid-token");
    const driver = new VercelSandboxDriver(provider, {
      ...providerEnv("project-a"),
      VERCEL_TOKEN: "revoked-token",
    });

    await expect(
      driver.launch({
        runId: "run_rejected",
        image: "runner:integration",
        env: {},
        cpu: 1,
        memoryMb: 2048,
        timeoutMin: 5,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(provider.sandboxes.size).toBe(0);
  });
});

function providerEnv(projectId: string) {
  return {
    VERCEL_TOKEN: "valid-token",
    VERCEL_TEAM_ID: "team-facility",
    VERCEL_PROJECT_ID: projectId,
  };
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status } });
}

class InMemoryCommand {
  cmdId = "command-1";
  exitCode: number | null = null;
  entries: Array<{ data: string }> = [];
  signal?: string;

  async *logs() {
    for (const entry of this.entries) yield entry;
  }

  async wait() {
    if (this.exitCode === null)
      throw Object.assign(new Error("still running"), { name: "TimeoutError" });
    return { exitCode: this.exitCode };
  }

  async kill(signal = "SIGTERM") {
    this.signal = signal;
    this.exitCode = signal === "SIGKILL" ? 137 : 143;
  }
}

class InMemorySandbox {
  status: "pending" | "running" | "stopping" | "stopped" | "failed" | "aborted" | "snapshotting" =
    "running";
  command = new InMemoryCommand();
  deleted = false;

  constructor(
    readonly name: string,
    public tags: Record<string, string>,
  ) {}

  async runCommand() {
    return this.command;
  }

  async getCommand(id: string) {
    if (id !== this.command.cmdId) throw httpError(404);
    return this.command;
  }

  domain(port: number) {
    return `https://${port}-${this.name}.vercel.run`;
  }

  async update(input: { tags: Record<string, string> }) {
    this.tags = input.tags;
  }

  async stop() {
    this.status = "stopped";
    return {};
  }

  async delete() {
    this.deleted = true;
  }
}

class InMemoryVercelProvider implements VercelSandboxClient {
  sandboxes = new Map<string, InMemorySandbox>();

  constructor(private readonly acceptedToken: string) {}

  async create(input: Parameters<VercelSandboxClient["create"]>[0]) {
    this.authorize(input.token);
    const key = this.key(input, input.name);
    if (this.sandboxes.has(key)) throw httpError(409);
    const sandbox = new InMemorySandbox(input.name, input.tags);
    this.sandboxes.set(key, sandbox);
    return sandbox;
  }

  async get(input: Parameters<VercelSandboxClient["get"]>[0]) {
    this.authorize(input.token);
    const sandbox = this.sandboxes.get(this.key(input, input.name));
    if (!sandbox || sandbox.deleted) throw httpError(404);
    return sandbox;
  }

  onlySandbox() {
    const sandboxes = [...this.sandboxes.values()];
    if (sandboxes.length !== 1 || !sandboxes[0]) throw new Error("expected one sandbox");
    return sandboxes[0];
  }

  private authorize(token: string) {
    if (token !== this.acceptedToken) throw httpError(401);
  }

  private key(input: { teamId: string; projectId: string }, name: string) {
    return `${input.teamId}/${input.projectId}/${name}`;
  }
}
