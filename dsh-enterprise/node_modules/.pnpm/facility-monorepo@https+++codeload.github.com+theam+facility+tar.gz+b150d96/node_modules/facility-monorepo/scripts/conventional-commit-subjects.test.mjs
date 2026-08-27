import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_TYPES,
  assertPullRequest,
  assertRange,
  assertSubject,
  parseSubject,
  rangeImpact,
  releaseImpact,
  subjectsInRange,
} from "./conventional-commit-subjects.mjs";

const subjectScript = fileURLToPath(
  new URL("./conventional-commit-subjects.mjs", import.meta.url),
);
const repoRoot = dirname(dirname(subjectScript));

function subjectCli(command, environment, cwd = repoRoot) {
  return spawnSync(process.execPath, [subjectScript, command], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

function git(repoDir, args) {
  return execFileSync(
    "git",
    [
      "-c",
      "commit.gpgSign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "user.name=Facility Tests",
      "-c",
      "user.email=facility-tests@example.invalid",
      ...args,
    ],
    {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    },
  ).trim();
}

function localRepository(t, name) {
  const repoDir = mkdtempSync(join(tmpdir(), `facility-subjects-${name}-`));
  t.after(() => rmSync(repoDir, { recursive: true, force: true }));
  git(repoDir, ["init", "--initial-branch=main"]);
  writeFileSync(join(repoDir, "change.txt"), "base\n");
  git(repoDir, ["add", "change.txt"]);
  git(repoDir, ["commit", "-m", "chore: establish the fixture"]);
  return repoDir;
}

function commitChange(repoDir, content, subject, body) {
  writeFileSync(join(repoDir, "change.txt"), `${content}\n`);
  git(repoDir, ["add", "change.txt"]);
  git(repoDir, ["commit", "-m", subject, ...(body ? ["-m", body] : [])]);
}

function fakeRange(...messages) {
  const hashes = messages.map((_, index) => `commit-${index + 1}`);
  return {
    exec(_command, args) {
      if (args[0] === "log") return messages.length > 0 ? `${messages.join("\0")}\0` : "";
      if (args[0] === "rev-list") return hashes.length > 0 ? `${hashes.join("\n")}\n` : "";
      throw new Error(`unexpected git command: ${args.join(" ")}`);
    },
    isEmptyCommit() {
      return false;
    },
  };
}

test("the repository's allowed Conventional Commit types are accepted", () => {
  const expected = [
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
  ];

  assert.deepEqual(ALLOWED_TYPES, expected);
  for (const type of expected) {
    assert.deepEqual(parseSubject(`${type}: describe the change`), {
      type,
      scope: null,
      breaking: false,
      summary: "describe the change",
    });
  }
});

test("breaking markers and established punctuation in scopes are accepted", () => {
  assert.deepEqual(parseSubject("feat(web+api)!: replace the public contract"), {
    type: "feat",
    scope: "web+api",
    breaking: true,
    summary: "replace the public contract",
  });

  for (const scope of ["web+api", "api/auth", "registry,sandbox"]) {
    assert.deepEqual(assertSubject(`fix(${scope}): keep the existing scope`), {
      type: "fix",
      scope,
      breaking: false,
      summary: "keep the existing scope",
    });
  }
  assert.equal(assertSubject("perf!: remove the legacy path").breaking, true);
});

test("release impact follows the repository's 0.x version policy and full commit messages", () => {
  for (const type of ["feat", "fix", "perf", "revert"]) {
    assert.equal(releaseImpact(`${type}: describe the change`), "patch", type);
  }
  for (const type of ["docs", "style", "refactor", "test", "build", "ci", "chore"]) {
    assert.equal(releaseImpact(`${type}: describe the change`), "none", type);
  }
  assert.equal(releaseImpact("docs!: replace the public contract"), "minor");
  assert.equal(
    releaseImpact("fix: preserve the old subject\n\nBREAKING CHANGE: migrate the client"),
    "minor",
  );
  assert.equal(
    releaseImpact("fix: preserve the old subject\r\n\r\nBREAKING-CHANGE: migrate the client"),
    "minor",
  );
  assert.equal(
    releaseImpact(
      "docs: replace the contract\n\nRefs: #42\nBREAKING CHANGE: migrate the client\ncontinue with the second step\nCloses #123",
    ),
    "minor",
  );
  assert.equal(
    releaseImpact(
      "docs: explain the phrase\n\nBREAKING CHANGE: appears in an example\n\nThis is still documentation.",
    ),
    "none",
  );
  assert.equal(
    releaseImpact("docs: explain malformed input\nBREAKING CHANGE: missing footer separator"),
    "none",
  );
  for (const example of [
    "docs: quote output\n\nThe tool printed:\nBREAKING CHANGE: example text",
    "docs: show a fence\n\n```text\nBREAKING CHANGE: example text\n```",
    "docs: show indented code\n\n    BREAKING CHANGE: example text",
    "docs: omit the description\n\nBREAKING CHANGE: ",
    "docs: use a tab separator\n\nBREAKING CHANGE:\tmigrate the client",
  ]) {
    assert.equal(releaseImpact(example), "none", example);
  }
});

test("unknown types and malformed subjects are rejected", () => {
  for (const subject of [
    "unknown: describe the change",
    "  fix: describe the change",
    "fix(): describe the change",
    "fix(api(auth)): describe the change",
    "fix((): describe the change",
    "fix(api)): describe the change",
    "fix( ): describe the change",
    "fix(api\nauth): describe the change",
    "fix(api): describe\u001b[31m the change",
    "fix: render \u009b31mred output",
    "fix(api):",
    "fix(api):   ",
  ]) {
    assert.throws(() => assertSubject(subject), undefined, subject);
  }
});

test("commit ranges are read as non-merge subjects from base-exclusive history", () => {
  const calls = [];
  const subjects = subjectsInRange("base-sha", "head-sha", {
    repoDir: "/fixture/repository",
    exec(command, args, options) {
      calls.push({ command, args, options });
      return "feat: add the capability\n\nExplain the change.\0fix(api/auth)!: close the gap\n\0";
    },
  });

  assert.deepEqual(subjects, ["feat: add the capability", "fix(api/auth)!: close the gap"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "git");
  assert.deepEqual(calls[0].args, [
    "log",
    "-z",
    "--no-merges",
    "--format=%B",
    "base-sha..head-sha",
  ]);
  assert.equal(calls[0].options.cwd, "/fixture/repository");
  assert.equal(calls[0].options.encoding, "utf8");
});

test("pull request titles have the same release impact as their full commit range", () => {
  const patchRange = fakeRange("docs: explain the change\n", "fix: deliver the change\n");
  assert.deepEqual(rangeImpact("base", "head", patchRange), {
    subjects: ["docs: explain the change", "fix: deliver the change"],
    impact: "patch",
  });
  assert.deepEqual(assertPullRequest("feat: deliver the change", "base", "head", patchRange), {
    subjects: ["docs: explain the change", "fix: deliver the change"],
    impact: "patch",
  });
  assert.throws(
    () => assertPullRequest("ci: validate the change", "base", "head", patchRange),
    /title release impact \(none\) does not match its commit range \(patch\)/,
  );

  const breakingRange = fakeRange(
    "fix: replace the contract\n\nBREAKING CHANGE: migrate the client\n",
  );
  assert.deepEqual(
    assertPullRequest("fix!: replace the contract", "base", "head", breakingRange),
    { subjects: ["fix: replace the contract"], impact: "minor" },
  );
  assert.throws(
    () => assertPullRequest("fix: replace the contract", "base", "head", breakingRange),
    /title release impact \(patch\) does not match its commit range \(minor\)/,
  );

  const noReleaseRange = fakeRange("docs: explain the existing behavior\n");
  assert.throws(
    () => assertPullRequest("fix: explain the existing behavior", "base", "head", noReleaseRange),
    /title release impact \(patch\) does not match its commit range \(none\)/,
  );
});

test("pull request classification fails closed for an empty non-merge range", () => {
  assert.throws(
    () => assertPullRequest("docs: explain the change", "base", "head", fakeRange()),
    /no non-merge commits to classify/,
  );
});

test("release-impacting commits must not be empty before a possible rebase", (t) => {
  const repoDir = localRepository(t, "release-impacting-empty");
  const baseSha = git(repoDir, ["rev-parse", "HEAD"]);
  git(repoDir, ["commit", "--allow-empty", "-m", "fix: claim a delivered fix"]);
  const headSha = git(repoDir, ["rev-parse", "HEAD"]);

  assert.throws(
    () => assertPullRequest("fix: claim a delivered fix", baseSha, headSha, { repoDir }),
    /release-impacting empty commit is not allowed[\s\S]*fix: claim a delivered fix[\s\S]*Rebase merges can omit empty commits/,
  );
});

test("squash, no-ff, and rebase land the same footer-only breaking impact", (t) => {
  const squashRepo = localRepository(t, "squash");
  const squashBase = git(squashRepo, ["rev-parse", "HEAD"]);
  git(squashRepo, ["checkout", "-b", "squash-feature"]);
  commitChange(squashRepo, "squash step one", "fix(web+api): prepare the squash");
  commitChange(
    squashRepo,
    "squash step two",
    "docs(api/auth): describe the breaking squash",
    "BREAKING CHANGE: migrate the squash client",
  );
  const squashFeatureHead = git(squashRepo, ["rev-parse", "HEAD"]);
  assert.deepEqual(
    assertPullRequest(
      "feat(registry,sandbox)!: land one squash subject",
      squashBase,
      squashFeatureHead,
      { repoDir: squashRepo },
    ),
    {
      subjects: [
        "docs(api/auth): describe the breaking squash",
        "fix(web+api): prepare the squash",
      ],
      impact: "minor",
    },
  );
  git(squashRepo, ["checkout", "main"]);
  git(squashRepo, ["merge", "--squash", "squash-feature"]);
  git(squashRepo, ["commit", "-m", "feat(registry,sandbox)!: land one squash subject"]);
  const squashHead = git(squashRepo, ["rev-parse", "HEAD"]);

  assert.deepEqual(subjectsInRange(squashBase, squashHead, { repoDir: squashRepo }), [
    "feat(registry,sandbox)!: land one squash subject",
  ]);
  const squashImpact = rangeImpact(squashBase, squashHead, { repoDir: squashRepo });

  const mergeRepo = localRepository(t, "merge");
  const mergeBase = git(mergeRepo, ["rev-parse", "HEAD"]);
  git(mergeRepo, ["checkout", "-b", "merge-feature"]);
  commitChange(mergeRepo, "merge step one", "feat(api/auth): add the first commit");
  commitChange(
    mergeRepo,
    "merge step two",
    "docs(registry,sandbox): describe the breaking merge",
    "BREAKING CHANGE: migrate the merge client",
  );
  git(mergeRepo, ["checkout", "main"]);
  git(mergeRepo, ["merge", "--no-ff", "merge-feature", "-m", "Merge branch 'merge-feature'"]);
  const mergeHead = git(mergeRepo, ["rev-parse", "HEAD"]);

  assert.deepEqual(subjectsInRange(mergeBase, mergeHead, { repoDir: mergeRepo }), [
    "docs(registry,sandbox): describe the breaking merge",
    "feat(api/auth): add the first commit",
  ]);
  const mergeImpact = rangeImpact(mergeBase, mergeHead, { repoDir: mergeRepo });

  const rebaseRepo = localRepository(t, "rebase");
  git(rebaseRepo, ["checkout", "-b", "rebase-feature"]);
  commitChange(rebaseRepo, "rebase step one", "feat(api/auth): add the rebased feature");
  commitChange(
    rebaseRepo,
    "rebase step two",
    "docs(web+api): describe the breaking rebase",
    "BREAKING CHANGE: migrate the rebased client",
  );
  git(rebaseRepo, ["checkout", "main"]);
  writeFileSync(join(rebaseRepo, "main.txt"), "advance main\n");
  git(rebaseRepo, ["add", "main.txt"]);
  git(rebaseRepo, ["commit", "-m", "chore: advance the target branch"]);
  const rebaseBase = git(rebaseRepo, ["rev-parse", "HEAD"]);
  git(rebaseRepo, ["checkout", "rebase-feature"]);
  git(rebaseRepo, ["rebase", "main"]);
  git(rebaseRepo, ["checkout", "main"]);
  git(rebaseRepo, ["merge", "--ff-only", "rebase-feature"]);
  const rebaseHead = git(rebaseRepo, ["rev-parse", "HEAD"]);

  assert.deepEqual(subjectsInRange(rebaseBase, rebaseHead, { repoDir: rebaseRepo }), [
    "docs(web+api): describe the breaking rebase",
    "feat(api/auth): add the rebased feature",
  ]);
  const rebaseImpact = rangeImpact(rebaseBase, rebaseHead, { repoDir: rebaseRepo });

  assert.equal(squashImpact.impact, "minor");
  assert.equal(mergeImpact.impact, squashImpact.impact);
  assert.equal(rebaseImpact.impact, squashImpact.impact);
});

test("an empty commit subject is retained and rejected", (t) => {
  const repoDir = localRepository(t, "empty-subject");
  const baseSha = git(repoDir, ["rev-parse", "HEAD"]);
  git(repoDir, ["commit", "--allow-empty", "--allow-empty-message", "-m", ""]);
  const headSha = git(repoDir, ["rev-parse", "HEAD"]);

  assert.deepEqual(subjectsInRange(baseSha, headSha, { repoDir }), [""]);
  assert.throws(
    () => assertRange(baseSha, headSha, { repoDir }),
    /commit subject is not allowed:[\s\S]*""/,
  );
});

test("the exact first commit-message line is validated by the range CLI", (t) => {
  const repoDir = localRepository(t, "multiline-header");
  const baseSha = git(repoDir, ["rev-parse", "HEAD"]);
  git(repoDir, [
    "commit",
    "--allow-empty",
    "--cleanup=verbatim",
    "-m",
    "fix:\nsummary continued on a second line",
  ]);
  const headSha = git(repoDir, ["rev-parse", "HEAD"]);

  assert.deepEqual(subjectsInRange(baseSha, headSha, { repoDir }), ["fix:"]);
  const denied = subjectCli("range", { BASE_SHA: baseSha, HEAD_SHA: headSha }, repoDir);
  assert.notEqual(denied.status, 0, denied.stdout);
  assert.match(denied.stderr, /commit subject is not allowed:[\s\S]*"fix:"/);
});

test("leading whitespace in a landed subject is retained and rejected", (t) => {
  const repoDir = localRepository(t, "leading-whitespace");
  const baseSha = git(repoDir, ["rev-parse", "HEAD"]);
  git(repoDir, [
    "commit",
    "--allow-empty",
    "--cleanup=verbatim",
    "-m",
    "  fix: do not normalize the version input",
  ]);
  const headSha = git(repoDir, ["rev-parse", "HEAD"]);

  assert.deepEqual(subjectsInRange(baseSha, headSha, { repoDir }), [
    "  fix: do not normalize the version input",
  ]);
  assert.throws(
    () => assertRange(baseSha, headSha, { repoDir }),
    /commit subject is not allowed:[\s\S]*  fix: do not normalize/,
  );
});

test("the title CLI accepts valid input and denies invalid input", () => {
  const accepted = subjectCli("title", {
    TITLE: "feat(web+api)!: replace the public contract",
  });
  assert.equal(accepted.status, 0, accepted.stderr);

  const denied = subjectCli("title", { TITLE: "unknown: hide a release change" });
  assert.notEqual(denied.status, 0, denied.stdout);
  assert.match(denied.stderr, /unknown: hide a release change/);
});

test("the pull request CLI rejects squash impact that differs from the commit range", (t) => {
  const repoDir = localRepository(t, "pull-request-impact");
  const baseSha = git(repoDir, ["rev-parse", "HEAD"]);
  writeFileSync(join(repoDir, "change.txt"), "breaking change\n");
  git(repoDir, ["add", "change.txt"]);
  git(repoDir, [
    "commit",
    "-m",
    "fix: replace the public contract",
    "-m",
    "BREAKING CHANGE: migrate the client",
  ]);
  const headSha = git(repoDir, ["rev-parse", "HEAD"]);

  const accepted = subjectCli(
    "pr",
    {
      TITLE: "fix!: replace the public contract",
      BASE_SHA: baseSha,
      HEAD_SHA: headSha,
    },
    repoDir,
  );
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /release impact minor/);

  const denied = subjectCli(
    "pr",
    {
      TITLE: "fix: replace the public contract",
      BASE_SHA: baseSha,
      HEAD_SHA: headSha,
    },
    repoDir,
  );
  assert.notEqual(denied.status, 0, denied.stdout);
  assert.match(denied.stderr, /title release impact \(patch\).*commit range \(minor\)/s);
});

test("workflows validate edited titles, matching PR impact, and landed main commits", () => {
  const subjectWorkflow = readFileSync(
    new URL("../.github/workflows/pull-request-title.yml", import.meta.url),
    "utf8",
  );
  const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  const subjectTriggers = subjectWorkflow.split(/^jobs:/m)[0];
  assert.match(subjectTriggers, /push:\s*\n\s+branches:\s*\[main\]/);
  assert.match(subjectTriggers, /pull_request:\s*\n\s+types:/);
  for (const activity of ["opened", "synchronize", "reopened", "edited"]) {
    assert.match(subjectTriggers, new RegExp(`\\b${activity}\\b`));
  }
  assert.match(subjectWorkflow, /node scripts\/conventional-commit-subjects\.mjs title\b/);

  const jobs = subjectWorkflow.split(/(?=^  [a-zA-Z0-9_-]+:\s*$)/m);
  const titleJobs = jobs.filter((job) =>
    /node scripts\/conventional-commit-subjects\.mjs title\b/.test(job),
  );
  assert.equal(titleJobs.length, 1);
  assert.match(titleJobs[0], /if: github\.event_name == 'pull_request'/);

  const rangeJobs = jobs
    .filter((job) => /node scripts\/conventional-commit-subjects\.mjs range\b/.test(job));
  assert.equal(rangeJobs.length, 1, "the lightweight workflow must validate commit ranges");
  const rangeJob = rangeJobs[0];
  assert.doesNotMatch(rangeJob.split(/^\s+steps:/m)[0], /^\s+if:/m);
  assert.match(rangeJob, /fetch-depth:\s*0/);
  assert.match(rangeJob, /EVENT_NAME: \$\{\{ github\.event_name \}\}/);
  assert.match(rangeJob, /TITLE: \$\{\{ github\.event\.pull_request\.title \|\| '' \}\}/);
  assert.match(rangeJob, /node scripts\/conventional-commit-subjects\.mjs pr\b/);
  assert.match(
    rangeJob,
    /BASE_SHA: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}/,
  );
  assert.match(
    rangeJob,
    /HEAD_SHA: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,
  );
  assert.doesNotMatch(
    ciWorkflow,
    /node scripts\/conventional-commit-subjects\.mjs range\b/,
    "title or base edits must not rerun the full acceptance workflow",
  );
});
