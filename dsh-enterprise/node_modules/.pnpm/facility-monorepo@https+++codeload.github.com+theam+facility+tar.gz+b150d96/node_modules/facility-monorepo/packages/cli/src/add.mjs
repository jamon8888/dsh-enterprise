// `facility add <module>` — install a quality module: its STANDARD.md section,
// its reviewer subagent, its guards, and its hook rules.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { insertHookRules, insertModuleSection } from "./render.mjs";
import { fail, heading, ok, skip, warn } from "./ui.mjs";

export async function addModule(name, { dir, pkgRoot, banner = true }) {
  const moduleDir =
    name.startsWith(".") || isAbsolute(name) ? resolve(dir, name) : join(pkgRoot, "modules", name);

  const manifestPath = join(moduleDir, "module.json");
  if (!existsSync(manifestPath)) {
    const available = readdirSync(join(pkgRoot, "modules"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .join(", ");
    fail(`Unknown module "${name}". Available: ${available} (or a local path).`);
    return 1;
  }
  const module = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (banner) heading(`Adding module: ${module.title}`);

  // 1. Files (reviewer subagents, guards) — never overwrite.
  for (const file of module.files ?? []) {
    const target = join(dir, file.to);
    if (existsSync(target)) {
      skip(`${file.to} exists — left untouched`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(moduleDir, file.from), "utf8"));
    ok(file.to);
  }

  // 2. STANDARD.md section between the facility:modules markers.
  const standardPath = join(dir, "STANDARD.md");
  if (module.standardSection && existsSync(standardPath)) {
    const section = readFileSync(join(moduleDir, module.standardSection), "utf8");
    const { content, inserted } = insertModuleSection(readFileSync(standardPath, "utf8"), section, module.title);
    if (inserted) {
      writeFileSync(standardPath, content);
      ok(`STANDARD.md — "${module.title}" section`);
    } else {
      skip(`STANDARD.md already has the "${module.title}" section`);
    }
  } else if (module.standardSection) {
    warn("STANDARD.md not found — run `facility init` first.");
  }

  // 3. Hook rules spliced into protect-files.mjs at the module marker.
  if (module.hookRules) {
    const hookPath = join(dir, ".claude/hooks/protect-files.mjs");
    if (existsSync(hookPath)) {
      const fragment = readFileSync(join(moduleDir, module.hookRules), "utf8");
      const { content, inserted } = insertHookRules(readFileSync(hookPath, "utf8"), fragment, module.name);
      if (inserted) {
        writeFileSync(hookPath, content);
        ok(".claude/hooks/protect-files.mjs — rules spliced");
      } else {
        skip(".claude/hooks/protect-files.mjs already has this module's rules");
      }
    }
  }

  // 4. Record it in the manifest.
  const facilityManifestPath = join(dir, ".facility.json");
  if (existsSync(facilityManifestPath)) {
    const manifest = JSON.parse(readFileSync(facilityManifestPath, "utf8"));
    if (!manifest.modules?.includes(module.name)) {
      manifest.modules = [...(manifest.modules ?? []), module.name];
      writeFileSync(facilityManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }

  return 0;
}
