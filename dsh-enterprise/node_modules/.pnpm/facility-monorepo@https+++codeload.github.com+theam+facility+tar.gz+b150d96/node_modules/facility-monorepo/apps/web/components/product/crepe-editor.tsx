"use client";

import "@milkdown/crepe/theme/common/style.css";
import "./crepe-theme.css";

import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { useEffect, useRef } from "react";
import { artifactRefsPlugin } from "@/components/product/artifact-refs";

/**
 * The always-on WYSIWYG surface (Milkdown Crepe). Markdown stays the source
 * of truth — humans edit the exact text agents read and write — and there is
 * no edit mode: like Notion, the page IS the editor. The host owns saving.
 */
export function CrepeEditor({
  docKey,
  value,
  readOnly = false,
  placeholder,
  onMarkdownChange,
  onNavigateRef,
}: {
  /** Document identity — the editor recreates itself when it changes. */
  docKey: string;
  /** Initial markdown; the editor owns the document afterwards. */
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  onMarkdownChange?: (md: string) => void;
  /** Clicking an artifact ref (D001, [[R002]], [[CHARTER]]…) navigates to it. */
  onNavigateRef?: (artifactId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const changeRef = useRef(onMarkdownChange);
  changeRef.current = onMarkdownChange;
  const navRef = useRef(onNavigateRef);
  navRef.current = onNavigateRef;
  const initialReadOnly = useRef(readOnly);
  initialReadOnly.current = readOnly;
  const initialValue = useRef(value);
  initialValue.current = value;
  const initialPlaceholder = useRef(placeholder);
  initialPlaceholder.current = placeholder;

  // biome-ignore lint/correctness/useExhaustiveDependencies: docKey is the recreate trigger; value/placeholder/readOnly are initial-only via refs.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const crepe = new Crepe({
      root,
      defaultValue: initialValue.current,
      features: {
        [Crepe.Feature.ImageBlock]: false,
        [Crepe.Feature.Latex]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: initialPlaceholder.current ?? "write…",
        },
      },
    });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md) => changeRef.current?.(unescapeWikilinks(md)));
    });
    crepe.setReadonly(initialReadOnly.current);
    crepeRef.current = crepe;
    const created = crepe.create().then((editor) => {
      // Registered on the LIVE view, after create: immune to milkdown's
      // plugin-lifecycle ordering, which silently dropped $prose decorations.
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.updateState(
          view.state.reconfigure({
            plugins: [...view.state.plugins, artifactRefsPlugin(() => navRef.current)],
          }),
        );
      });
      return editor;
    });
    return () => {
      crepeRef.current = null;
      void created.then(() => crepe.destroy());
    };
  }, [docKey]);

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  return <div ref={rootRef} className="facility-crepe h-full min-h-0" />;
}

/**
 * ProseMirror serializes literal brackets as \[\[X\]\] — which would corrupt
 * the wikilink syntax on every save (and make ensureLinks re-append refs it
 * can no longer recognize). Restore the canonical [[X]] form.
 */
const WIKILINK_ESCAPE_RE = /\\\[\\\[([A-Z]{1,2}\d{3}|CHARTER|ACTIVE)(?:\\\]\\\]|\]\])/g;

function unescapeWikilinks(md: string): string {
  return md.replace(WIKILINK_ESCAPE_RE, "[[$1]]");
}
