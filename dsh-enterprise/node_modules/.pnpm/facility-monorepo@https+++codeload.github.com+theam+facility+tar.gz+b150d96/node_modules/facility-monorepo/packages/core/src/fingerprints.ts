import { createHash } from "node:crypto";

export type ManifestFile = { path: string; sha256: string };
export type Manifest = { version: 1; files: ManifestFile[]; manifestHash: string };

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function manifestFor(files: { path: string; content: string }[]): Manifest {
  const manifestFiles = files
    .map((file) => ({ path: file.path, sha256: sha256Hex(file.content) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const manifestHash = sha256Hex(JSON.stringify(manifestFiles));
  return { version: 1, files: manifestFiles, manifestHash };
}

export function diffManifest(
  expected: Manifest,
  actual: Manifest,
  managedPaths = expected.files.map((file) => file.path),
): { missing: string[]; modified: string[]; extra: string[] } {
  const expectedMap = new Map(expected.files.map((file) => [file.path, file.sha256]));
  const actualMap = new Map(actual.files.map((file) => [file.path, file.sha256]));
  const missing: string[] = [];
  const modified: string[] = [];
  const managed = new Set(managedPaths);
  for (const [path, hash] of expectedMap) {
    const actualHash = actualMap.get(path);
    if (!actualHash) {
      missing.push(path);
    } else if (actualHash !== hash) {
      modified.push(path);
    }
  }
  const extra = [...actualMap.keys()].filter((path) => !expectedMap.has(path) && managed.has(path));
  return { missing, modified, extra };
}
