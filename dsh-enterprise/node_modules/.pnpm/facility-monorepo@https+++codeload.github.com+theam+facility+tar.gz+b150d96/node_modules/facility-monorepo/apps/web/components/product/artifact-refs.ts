import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";

/**
 * Bare codes are the detection unit (D001, CR012, CHARTER, ACTIVE) — they
 * match inside [[wikilinks]] too, so only the code itself lights up, not the
 * bracket ceremony.
 */
const REF_RE = /\b([A-Z]{1,2}\d{3}|CHARTER|ACTIVE)\b/g;
const CODE_NODES = new Set(["code_block", "codeBlock"]);
const CODE_MARKS = new Set(["inlineCode", "code_inline", "code"]);

/**
 * Scan per TEXTBLOCK, not per text node: the parser splits literal brackets
 * into separate text nodes. Non-text and code content becomes same-size
 * filler, which keeps every character of the joined string at doc position
 * blockStart + 1 + index.
 */
function decorate(doc: ProseNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (CODE_NODES.has(node.type.name)) return false;
    let joined = "";
    node.forEach((child) => {
      if (child.isText) {
        const insideCode = child.marks.some((mark) => CODE_MARKS.has(mark.type.name));
        const text = child.text ?? "";
        joined += insideCode ? " ".repeat(text.length) : text;
      } else {
        joined += " ".repeat(child.nodeSize);
      }
    });
    for (const match of joined.matchAll(REF_RE)) {
      const ref = match[1];
      if (!ref) continue;
      const from = pos + 1 + (match.index ?? 0);
      decorations.push(
        Decoration.inline(from, from + match[0].length, {
          class: "artifact-ref",
          "data-ref": ref,
          title: `open ${ref}`,
        }),
      );
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Artifact refs rendered as live links inside the editor: decorated and
 * clickable, while the markdown stays plain text — agents read exactly what
 * humans see. A raw ProseMirror plugin, registered straight onto the live
 * EditorView (state.reconfigure) after Crepe creates it — no dependence on
 * milkdown's plugin lifecycle timing.
 */
export function artifactRefsPlugin(getNavigate: () => ((ref: string) => void) | undefined) {
  return new Plugin({
    key: new PluginKey("facility-artifact-refs"),
    state: {
      init: (_config, state) => decorate(state.doc),
      apply: (tr, decorations, _old, state) => (tr.docChanged ? decorate(state.doc) : decorations),
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleClick(_view, _pos, event) {
        const ref = (event.target as HTMLElement | null)
          ?.closest?.(".artifact-ref")
          ?.getAttribute("data-ref");
        const navigate = getNavigate();
        if (ref && navigate) {
          navigate(ref);
          return true;
        }
        return false;
      },
    },
  });
}
