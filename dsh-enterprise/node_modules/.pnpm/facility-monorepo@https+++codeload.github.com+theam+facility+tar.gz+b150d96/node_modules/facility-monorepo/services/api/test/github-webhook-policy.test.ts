import { describe, expect, it } from "vitest";
import { githubTriggerRequiresClient } from "../src/github/router.js";
import { githubWebhookRequiresWorker } from "../src/routes/webhooks.js";

describe("GitHub webhook scheduling policy", () => {
  it("persists but does not schedule workflow lifecycle actions with no processor output", () => {
    expect(githubWebhookRequiresWorker("workflow_run", { action: "requested" })).toBe(false);
    expect(githubWebhookRequiresWorker("workflow_run", { action: "in_progress" })).toBe(false);
    expect(githubWebhookRequiresWorker("workflow_run", { action: "queued" })).toBe(false);
    expect(githubWebhookRequiresWorker("workflow_run", { action: "completed" })).toBe(true);
    expect(githubWebhookRequiresWorker("check_run", { action: "created" })).toBe(true);
  });

  it("creates a GitHub client only for supported human commands", () => {
    const base = {
      action: "created",
      issue: { number: 42, title: "Task" },
      repository: { owner: { login: "octo" }, name: "repo" },
      sender: { login: "ada", type: "User" },
    };
    expect(
      githubTriggerRequiresClient({ ...base, comment: { id: 1, body: "ordinary discussion" } }),
    ).toBe(false);
    expect(
      githubTriggerRequiresClient({ ...base, comment: { id: 2, body: "/architect\nPlan this" } }),
    ).toBe(true);
    expect(
      githubTriggerRequiresClient({
        ...base,
        sender: { login: "bot", type: "Bot" },
        comment: { id: 3, body: "/architect" },
      }),
    ).toBe(false);
    expect(
      githubTriggerRequiresClient({
        ...base,
        action: "edited",
        comment: { id: 4, body: "/architect" },
      }),
    ).toBe(false);
  });
});
