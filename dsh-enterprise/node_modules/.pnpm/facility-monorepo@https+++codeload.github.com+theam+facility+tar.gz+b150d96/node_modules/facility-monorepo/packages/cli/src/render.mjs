// Template rendering and managed-content insertion.
//
// Placeholders are {{UPPER_SNAKE}} with no spaces, so GitHub Actions
// expressions (`${{ secrets.X }}` — spaces, lowercase, dots) never match and
// pass through untouched.

/**
 * Substitute {{VARS}} in a template. A placeholder alone on its line is a
 * block variable: an empty value removes the whole line, a multi-line value
 * lands verbatim. Unknown placeholders are left as-is.
 */
export function render(template, vars) {
  const withBlocks = template.replace(
    /^[ \t]*\{\{([A-Z0-9_]+)\}\}[ \t]*\r?\n/gm,
    (match, name) => {
      const value = vars[name];
      if (value === undefined) return match;
      if (value === "") return "";
      return value.endsWith("\n") ? value : `${value}\n`;
    }
  );
  return withBlocks.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name) => vars[name] ?? match);
}

/** True when `content` already contains the facility managed-block marker. */
export function hasManagedBlock(content) {
  return content.includes("<!-- facility:start");
}

/** Append a managed block to existing file content (with a blank line). */
export function appendManagedBlock(content, block) {
  const base = content.replace(/\s*$/, "");
  return base ? `${base}\n\n${block}` : block;
}

const MODULES_START = "<!-- facility:modules:start -->";
const MODULES_END = "<!-- facility:modules:end -->";

/** Insert a module's standard section between the modules markers. */
export function insertModuleSection(standard, section, moduleTitle) {
  if (standard.includes(`(facility module)`) && standard.includes(`### ${moduleTitle} (facility module)`)) {
    return { content: standard, inserted: false };
  }
  const end = standard.indexOf(MODULES_END);
  if (end === -1) {
    // No markers (user removed them): append under a Modules heading instead.
    const block = `\n## Modules\n\n${section.trim()}\n`;
    return { content: `${standard.replace(/\s*$/, "")}\n${block}`, inserted: true };
  }
  const before = standard.slice(0, end).replace(/[ \t]*$/, "");
  const after = standard.slice(end);
  return { content: `${before}${section.trim()}\n\n${after}`, inserted: true };
}

const HOOK_MARKER = "/* facility:module-rules */";

/** Splice a module's hook rules at the marker in protect-files.mjs. */
export function insertHookRules(hookSource, fragment, moduleName) {
  const sentinel = `facility module: ${moduleName}`;
  if (hookSource.includes(sentinel)) return { content: hookSource, inserted: false };
  if (!hookSource.includes(HOOK_MARKER)) return { content: hookSource, inserted: false };
  return {
    content: hookSource.replace(HOOK_MARKER, `${fragment.trim()}\n\n${HOOK_MARKER}`),
    inserted: true,
  };
}
