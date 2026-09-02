#!/usr/bin/env node
// The subjects that land on main decide the released version. Keep the policy
// here so PR-title checks, PR commit checks, and landed-history checks cannot
// drift into accepting different commit grammars.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ALLOWED_TYPES = Object.freeze([
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
]);

const SUBJECT = new RegExp(
  `^(?<type>${ALLOWED_TYPES.join("|")})(?:\\((?<scope>(?=\\S)[^()\\r\\n]*[^\\s()\\r\\n])\\))?(?<breaking>!)?: (?<summary>\\S.*)$`,
);
const PATCH_TYPES = new Set(["feat", "fix", "perf", "revert"]);
const IMPACT_RANK = Object.freeze({ none: 0, patch: 1, minor: 2 });

function hasForbiddenSubjectCharacters(subject) {
  return [...subject].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

export function parseSubject(subject) {
  if (typeof subject !== "string") return null;
  if (hasForbiddenSubjectCharacters(subject)) return null;
  const match = SUBJECT.exec(subject);
  if (!match?.groups) return null;
  return {
    type: match.groups.type,
    scope: match.groups.scope ?? null,
    breaking: match.groups.breaking === "!",
    summary: match.groups.summary,
  };
}

export function assertSubject(subject, { label = "subject" } = {}) {
  const parsed = parseSubject(subject);
  if (parsed) return parsed;
  throw new Error(
    `${label} is not an allowed Conventional Commit: ${JSON.stringify(subject)}\n` +
      "Expected: <type>[(scope)][!]: <what changed>\n" +
      `Allowed types: ${ALLOWED_TYPES.join(" ")}`,
  );
}

export function subjectOf(message) {
  return message.split(/\r?\n/, 1)[0] ?? "";
}

function hasBreakingFooter(message) {
  const blocks = message.replace(/\r\n/g, "\n").trimEnd().split(/\n[ \t]*\n+/);
  if (blocks.length < 2) return false;
  const lines = (blocks.at(-1) ?? "").split("\n");
  const trailer = /^(?:(?:[A-Za-z0-9-]+|BREAKING CHANGE): +\S|[A-Za-z0-9-]+ #\S)/;
  const breakingTrailer = /^BREAKING(?: |-)CHANGE: +\S/;

  // A footer is the final, blank-line-separated trailer block. Once that block
  // begins with a trailer, non-token lines are multiline value continuation;
  // a later BREAKING CHANGE token starts another footer.
  if (!trailer.test(lines[0] ?? "")) return false;
  return lines.some((line) => breakingTrailer.test(line));
}

export function releaseImpact(message) {
  const parsed = assertSubject(subjectOf(message));
  if (parsed.breaking || hasBreakingFooter(message)) return "minor";
  return PATCH_TYPES.has(parsed.type) ? "patch" : "none";
}

export function messagesForRevision(
  revision,
  { repoDir = process.cwd(), exec = execFileSync } = {},
) {
  if (!revision) throw new Error("a git revision is required");
  const output = exec(
    "git",
    ["log", "-z", "--no-merges", "--format=%B", revision],
    { cwd: repoDir, encoding: "utf8" },
  );
  if (!output) return [];
  const messages = output.split("\0");
  if (messages.at(-1) === "") messages.pop();
  return messages;
}

export function messagesInRange(baseSha, headSha, options) {
  if (!baseSha || !headSha) throw new Error("both BASE_SHA and HEAD_SHA are required");
  return messagesForRevision(`${baseSha}..${headSha}`, options);
}

export function subjectsInRange(baseSha, headSha, options) {
  return messagesInRange(baseSha, headSha, options).map(subjectOf);
}

function assertMessages(messages) {
  const subjects = messages.map(subjectOf);
  const invalid = subjects.filter((subject) => !parseSubject(subject));
  if (invalid.length > 0) {
    throw new Error(
      [
        `${invalid.length} commit subject${invalid.length === 1 ? " is" : "s are"} not allowed:`,
        ...invalid.map((subject) => `  ${JSON.stringify(subject)}`),
        "Expected: <type>[(scope)][!]: <what changed>",
        `Allowed types: ${ALLOWED_TYPES.join(" ")}`,
      ].join("\n"),
    );
  }
  return subjects;
}

export function assertRange(baseSha, headSha, options) {
  return assertMessages(messagesInRange(baseSha, headSha, options));
}

function maximumImpact(messages) {
  return messages.reduce(
    (highest, message) => {
      const impact = releaseImpact(message);
      return IMPACT_RANK[impact] > IMPACT_RANK[highest] ? impact : highest;
    },
    "none",
  );
}

function commitHashesInRange(
  baseSha,
  headSha,
  { repoDir = process.cwd(), exec = execFileSync } = {},
) {
  const output = exec(
    "git",
    ["rev-list", "--no-merges", `${baseSha}..${headSha}`],
    { cwd: repoDir, encoding: "utf8" },
  );
  return output.trim() ? output.trim().split(/\r?\n/) : [];
}

function gitCommitIsEmpty(
  hash,
  { repoDir = process.cwd(), exec = execFileSync, isEmptyCommit } = {},
) {
  if (isEmptyCommit) return Boolean(isEmptyCommit(hash));
  try {
    exec(
      "git",
      ["diff-tree", "--quiet", "--exit-code", "--root", hash],
      { cwd: repoDir, stdio: "ignore" },
    );
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.status === 1) return false;
    throw error;
  }
}

function assertNoReleaseImpactingEmptyCommits(baseSha, headSha, messages, options) {
  const hashes = commitHashesInRange(baseSha, headSha, options);
  if (hashes.length !== messages.length) {
    throw new Error(
      `could not pair ${messages.length} commit message${messages.length === 1 ? "" : "s"} with ${hashes.length} commit hash${hashes.length === 1 ? "" : "es"}`,
    );
  }
  const empty = hashes.flatMap((hash, index) => {
    if (releaseImpact(messages[index]) === "none" || !gitCommitIsEmpty(hash, options)) return [];
    return [{ hash, subject: subjectOf(messages[index]) }];
  });
  if (empty.length === 0) return;
  throw new Error(
    [
      `${empty.length} release-impacting empty commit${empty.length === 1 ? " is" : "s are"} not allowed:`,
      ...empty.map(({ hash, subject }) => `  ${hash} ${JSON.stringify(subject)}`),
      "Rebase merges can omit empty commits, which would choose a different next version from squash or merge.",
    ].join("\n"),
  );
}

export function rangeImpact(baseSha, headSha, options) {
  const messages = messagesInRange(baseSha, headSha, options);
  return { subjects: assertMessages(messages), impact: maximumImpact(messages) };
}

export function assertPullRequest(title, baseSha, headSha, options) {
  assertSubject(title, { label: "pull request title" });
  const messages = messagesInRange(baseSha, headSha, options);
  const range = { subjects: assertMessages(messages), impact: maximumImpact(messages) };
  if (range.subjects.length === 0) {
    throw new Error("pull request has no non-merge commits to classify");
  }
  assertNoReleaseImpactingEmptyCommits(baseSha, headSha, messages, options);
  const titleImpact = releaseImpact(title);
  const commitImpact = range.impact;
  if (titleImpact !== commitImpact) {
    throw new Error(
      [
        `pull request title release impact (${titleImpact}) does not match its commit range (${commitImpact})`,
        `Title: ${JSON.stringify(title)}`,
        "Commit subjects:",
        ...range.subjects.map((subject) => `  ${JSON.stringify(subject)}`),
        "Make them match so PR metadata and every supported merge configuration declare the same next version.",
      ].join("\n"),
    );
  }
  return range;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function main() {
  const command = process.argv[2];
  if (command === "title") {
    const title = required("TITLE");
    assertSubject(title, { label: "pull request title" });
    console.log(`OK: ${title}`);
    return;
  }
  if (command === "range") {
    const subjects = assertRange(required("BASE_SHA"), required("HEAD_SHA"));
    console.log(`OK: ${subjects.length} non-merge commit subject${subjects.length === 1 ? "" : "s"}`);
    return;
  }
  if (command === "pr") {
    const result = assertPullRequest(
      required("TITLE"),
      required("BASE_SHA"),
      required("HEAD_SHA"),
    );
    console.log(
      `OK: ${result.subjects.length} non-merge commit subject${result.subjects.length === 1 ? "" : "s"}; release impact ${result.impact}`,
    );
    return;
  }
  throw new Error("Usage: conventional-commit-subjects.mjs title|range|pr");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
