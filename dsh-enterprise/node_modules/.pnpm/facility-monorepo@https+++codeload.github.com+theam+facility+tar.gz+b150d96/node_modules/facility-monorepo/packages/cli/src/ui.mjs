// Terminal output helpers. Zero dependencies; ANSI only when it's a TTY and
// NO_COLOR is unset. Restrained on purpose — the CLI should read like a
// well-run factory floor, not a slot machine.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = "\u001b";

const wrap = (code) => (text) => (useColor ? `${ESC}[${code}m${text}${ESC}[0m` : String(text));

export const bold = wrap("1");
export const dim = wrap("2");
export const accent = wrap("38;5;220"); // facility yellow — reserved for agent work
export const green = wrap("32");
export const red = wrap("31");
export const yellow = wrap("33");

export function banner(version) {
  console.log("");
  console.log(`  ${bold("facility")} ${dim(`v${version}`)} ${dim("— the AI software factory for your repo")}`);
  console.log("");
}

export function heading(text) {
  console.log(`\n${bold(text)}`);
}

export const ok = (text) => console.log(`  ${green("✓")} ${text}`);
export const skip = (text) => console.log(`  ${dim("—")} ${dim(text)}`);
export const warn = (text) => console.log(`  ${yellow("!")} ${text}`);
export const fail = (text) => console.log(`  ${red("✗")} ${text}`);
export const item = (text) => console.log(`  ${text}`);
