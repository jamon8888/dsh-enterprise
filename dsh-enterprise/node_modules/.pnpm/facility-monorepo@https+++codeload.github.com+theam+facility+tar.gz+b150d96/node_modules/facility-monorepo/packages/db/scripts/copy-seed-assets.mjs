import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(packageRoot, "../..");
const destinationRoot = join(packageRoot, "dist/seed-assets");

const assetDirectories = [
  "packages/harness/contracts",
  "packages/cli/templates",
  "packages/cli/modules",
];

mkdirSync(destinationRoot, { recursive: true });
for (const relativePath of assetDirectories) {
  const source = join(workspaceRoot, relativePath);
  if (!existsSync(source)) {
    throw new Error(`Required seed asset directory is missing: ${relativePath}`);
  }
  cpSync(source, join(destinationRoot, relativePath), { recursive: true, force: true });
}

const requiredAssets = [
  "packages/harness/contracts/po-agent.md",
  "packages/harness/contracts/learning-agent.md",
];
for (const relativePath of requiredAssets) {
  if (!existsSync(join(destinationRoot, relativePath))) {
    throw new Error(`Required seed asset was not packaged: ${relativePath}`);
  }
}
