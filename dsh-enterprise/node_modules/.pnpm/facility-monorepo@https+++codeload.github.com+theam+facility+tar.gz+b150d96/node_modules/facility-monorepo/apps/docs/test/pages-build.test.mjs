import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the GitHub Pages build keeps canonical and local URLs under /facility", {
  timeout: 180_000,
}, () => {
  const temporaryDir = mkdtempSync(join(tmpdir(), "facility-docs-pages-"));
  const outputDir = join(temporaryDir, "build");

  try {
    const corePackage = require.resolve("@docusaurus/core/package.json");
    const { bin } = JSON.parse(readFileSync(corePackage, "utf8"));
    const cli = resolve(dirname(corePackage), typeof bin === "string" ? bin : bin.docusaurus);
    const result = spawnSync(process.execPath, [cli, "build", "--out-dir", outputDir], {
      cwd: docsDir,
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "true",
        DOCS_URL: "https://theam.github.io",
        DOCS_BASE_URL: "/facility",
      },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 170_000,
    });

    assert.equal(
      result.status,
      0,
      `Docusaurus Pages build failed:\n${result.stdout}\n${result.stderr}`,
    );

    const html = readFileSync(join(outputDir, "index.html"), "utf8");
    const canonicalUrl = html.match(
      /<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"[^>]*>/,
    )?.[1];
    assert.equal(
      canonicalUrl,
      "https://theam.github.io/facility/",
      "the canonical URL should combine DOCS_URL with DOCS_BASE_URL",
    );

    const localReferences = [...html.matchAll(/\b(?:href|src)="(\/(?!\/)[^"]+)"/g)].map(
      ([, reference]) => reference,
    );
    assert.ok(
      localReferences.some((reference) => reference.startsWith("/facility/assets/")),
      "the built page should load an asset from /facility/assets/",
    );
    assert.ok(
      localReferences.some(
        (reference) => reference === "/facility/" || reference.startsWith("/facility/concepts/"),
      ),
      "the built page should link to content under /facility/",
    );
    assert.deepEqual(
      localReferences.filter((reference) => !reference.startsWith("/facility/")),
      [],
      "no root-relative link or asset may escape the configured Pages base path",
    );
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true });
  }
});
