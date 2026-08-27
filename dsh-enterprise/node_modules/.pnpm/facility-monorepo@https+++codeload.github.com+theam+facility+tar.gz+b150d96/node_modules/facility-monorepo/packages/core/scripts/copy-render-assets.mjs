import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(packageRoot, "../..");
const destinationRoot = join(packageRoot, "dist/render-assets");
const assetDirectories = ["packages/cli/templates", "packages/cli/modules"];

mkdirSync(destinationRoot, { recursive: true });
for (const relativePath of assetDirectories) {
  const source = join(workspaceRoot, relativePath);
  if (!existsSync(source)) {
    throw new Error(`Required render asset directory is missing: ${relativePath}`);
  }
  cpSync(source, join(destinationRoot, relativePath), { recursive: true, force: true });
}

const canary = "packages/cli/templates/watchtower/canary.mjs";
if (!existsSync(join(destinationRoot, canary))) {
  throw new Error(`Required render asset was not packaged: ${canary}`);
}
