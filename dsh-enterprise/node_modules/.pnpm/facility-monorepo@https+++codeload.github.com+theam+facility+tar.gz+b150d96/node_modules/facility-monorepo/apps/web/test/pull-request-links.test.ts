import { describe, expect, it } from "vitest";
import type { PipelinePullRequest, PipelineStory } from "@/lib/api";
import {
  detachablePullRequests,
  linkableIssues,
  linkablePullRequests,
} from "@/lib/pull-request-links";

describe("story pull-request link candidates", () => {
  const stories = [
    story("repo-a", "issue", 10, "open"),
    story("repo-a", "issue", 11, "closed"),
    story("repo-a", "pull_request", 20, "open"),
    story("repo-b", "pull_request", 21, "open"),
  ];

  it("offers only open same-repository stories of the requested kind", () => {
    expect(linkableIssues(stories, "repo-a")).toEqual([{ number: 10, title: "Story 10" }]);
    expect(linkablePullRequests(stories, "repo-a")).toEqual([{ number: 20, title: "Story 20" }]);
  });

  it("offers detach only for a real open GitHub closing reference", () => {
    const linked = pull(20, [10]);
    expect(detachablePullRequests(10, [linked, pull(21, []), pull(22, [10], "merged")])).toEqual([
      linked,
    ]);
  });
});

function story(
  repoId: string,
  storyType: PipelineStory["storyType"],
  number: number,
  state: PipelineStory["state"],
) {
  return { repoId, storyType, number, state, title: `Story ${number}` } as PipelineStory;
}

function pull(
  number: number,
  closingIssues: number[],
  state: PipelinePullRequest["state"] = "open",
) {
  return { number, closingIssues, state } as PipelinePullRequest;
}
