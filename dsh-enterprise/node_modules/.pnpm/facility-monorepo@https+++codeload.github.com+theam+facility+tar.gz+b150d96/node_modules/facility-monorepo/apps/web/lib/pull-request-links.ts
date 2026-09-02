import type { PipelinePullRequest, PipelineStory } from "./api";

type CandidateStory = Pick<PipelineStory, "number" | "repoId" | "state" | "storyType" | "title">;

export type StoryLinkCandidate = { number: number; title: string };

export function linkableIssues(stories: CandidateStory[], repoId: string): StoryLinkCandidate[] {
  return candidates(stories, repoId, "issue");
}

export function linkablePullRequests(
  stories: CandidateStory[],
  repoId: string,
): StoryLinkCandidate[] {
  return candidates(stories, repoId, "pull_request");
}

export function detachablePullRequests(
  issueNumber: number,
  pulls: PipelinePullRequest[],
): PipelinePullRequest[] {
  return pulls.filter((pull) => pull.state === "open" && pull.closingIssues.includes(issueNumber));
}

function candidates(
  stories: CandidateStory[],
  repoId: string,
  storyType: CandidateStory["storyType"],
) {
  return stories
    .filter(
      (story) => story.repoId === repoId && story.storyType === storyType && story.state === "open",
    )
    .map(({ number, title }) => ({ number, title }))
    .sort((left, right) => left.number - right.number);
}
