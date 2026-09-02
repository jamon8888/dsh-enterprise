"use client";

import { PillTag } from "@facility/ui";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { CopyRef } from "@/components/product/copy-ref";
import { CrepeEditor } from "@/components/product/crepe-editor";
import { fmtStamp, stripFrontmatter } from "@/lib/kb";

export type ArtifactMeta = {
  /** Small type title before the id: "decision", "signal", "resource"… */
  typeLabel: string;
  artifactId: string;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PanelLinkGroup = {
  label: string;
  items: { key: string; ref: string; label: string }[];
};

export type AboutRow = { label: string; value: string; href?: string };

export type VersionRow = {
  id: string;
  version: number;
  bodyMd: string;
  createdAt: string;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

const AUTOSAVE_MS = 1200;

/**
 * The one page template every KB artifact renders through: a compact header
 * ("decision D003 · copy ref · created … · updated …"), the always-editable
 * Crepe surface with debounced autosave, and a hidden-by-default details
 * panel holding links and version history. Consistency is the feature.
 */
export function ArtifactPage({
  docKey,
  meta,
  body,
  readOnly,
  placeholder,
  onSave,
  aboutRows = [],
  linkGroups = [],
  versionsUrl,
  onNavigate,
}: {
  docKey: string;
  meta: ArtifactMeta;
  /** Prose only — the host strips and re-attaches frontmatter around saves. */
  body: string;
  readOnly: boolean;
  placeholder?: string;
  onSave: (md: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  aboutRows?: AboutRow[];
  linkGroups?: PanelLinkGroup[];
  /** Same-origin URL returning this page's stored versions (newest first). */
  versionsUrl: string;
  onNavigate: (ref: string) => void;
}) {
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [panelOpen, setPanelOpen] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [preview, setPreview] = useState<VersionRow | null>(null);

  const lastSavedRef = useRef(body);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(async () => {
    if (inFlightRef.current) return;
    const md = pendingRef.current;
    if (md === null || md === lastSavedRef.current) return;
    inFlightRef.current = true;
    setSave({ kind: "saving" });
    const res = await onSaveRef.current(md);
    inFlightRef.current = false;
    if (res.ok) {
      lastSavedRef.current = md;
      setSave({ kind: "saved" });
      // Keystrokes that landed mid-save get their own pass.
      if (pendingRef.current !== md) void flush();
    } else {
      setSave({ kind: "error", message: res.message });
    }
  }, []);

  const handleChange = useCallback(
    (md: string) => {
      pendingRef.current = md;
      if (md === lastSavedRef.current) return;
      setSave((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  // Leaving the page flushes whatever the debounce hadn't saved yet.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    if (!panelOpen || versions !== null) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(versionsUrl, { cache: "no-store" });
        if (!response.ok) return;
        const rows = (await response.json()) as VersionRow[];
        if (!cancelled) setVersions(rows);
      } catch {
        // History is best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panelOpen, versions, versionsUrl]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--line) px-5 py-2.5">
        <span className="text-[11px] text-(--dim)">{meta.typeLabel}</span>
        <span className="font-mono text-[13px] font-medium text-(--ink)">{meta.artifactId}</span>
        <CopyRef artifactId={meta.artifactId} />
        {meta.status ? <PillTag>{meta.status}</PillTag> : null}
        {meta.createdAt ? (
          <span className="font-mono text-[10.5px] text-(--dim)">
            created {fmtStamp(meta.createdAt)}
          </span>
        ) : null}
        {meta.updatedAt ? (
          <span className="font-mono text-[10.5px] text-(--dim)">
            updated {fmtStamp(meta.updatedAt)}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-3">
          <SaveBadge state={save} readOnly={readOnly} />
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="border border-(--line) px-2 py-1 font-mono text-[10.5px] text-(--dim) hover:border-(--line-strong) hover:text-(--ink)"
            title="links & history"
          >
            {panelOpen ? "details ×" : "details"}
          </button>
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="h-full min-h-0 overflow-y-auto">
          {preview ? (
            <div className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-3 border border-(--line) bg-(--card) px-4 py-2.5">
                <span className="font-mono text-[11px] text-(--human)">
                  viewing v{preview.version} · {fmtStamp(preview.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="font-mono text-[11px] text-(--info,--mut) underline-offset-2 hover:underline"
                >
                  back to current
                </button>
              </div>
              <Markdown source={stripFrontmatter(preview.bodyMd)} />
            </div>
          ) : (
            <CrepeEditor
              docKey={docKey}
              value={body}
              readOnly={readOnly}
              placeholder={placeholder}
              onMarkdownChange={handleChange}
              onNavigateRef={onNavigate}
            />
          )}
        </div>

        {panelOpen ? (
          <aside className="absolute inset-y-0 right-0 z-10 flex w-[280px] flex-col gap-5 overflow-y-auto border-l border-(--line) bg-(--bg) p-4 text-[12px] shadow-[-12px_0_40px_rgba(0,0,0,0.35)]">
            {aboutRows.length > 0 ? (
              <PanelSection label="about">
                <dl className="flex flex-col gap-1.5">
                  {aboutRows.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-2">
                      <dt className="text-(--dim)">{row.label}</dt>
                      <dd className="min-w-0 truncate text-right font-mono text-[11px] text-(--mut)">
                        {row.href ? (
                          <Link
                            href={row.href}
                            className="text-(--info) underline underline-offset-4"
                          >
                            {row.value}
                          </Link>
                        ) : (
                          row.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </PanelSection>
            ) : null}

            {linkGroups.map((group) =>
              group.items.length > 0 ? (
                <PanelSection key={group.label} label={group.label}>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onNavigate(item.ref)}
                        className="flex items-baseline gap-2 text-left text-(--mut) hover:text-(--ink)"
                      >
                        <span className="shrink-0 font-mono text-[10.5px] text-(--dim)">
                          {item.ref}
                        </span>
                        <span className="min-w-0 truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </PanelSection>
              ) : null,
            )}

            <PanelSection label={versions === null ? "history" : `history · ${versions.length}`}>
              {versions === null ? (
                <p className="text-[11px] italic text-(--dim)">loading…</p>
              ) : versions.length === 0 ? (
                <p className="text-[11px] italic text-(--dim)">no earlier versions</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => {
                        setPreview(version);
                        setPanelOpen(false);
                      }}
                      title="view this version"
                      className="flex items-baseline gap-2 text-left text-(--mut) hover:text-(--ink)"
                    >
                      <span className="shrink-0 font-mono text-[10.5px] text-(--dim)">
                        v{version.version}
                      </span>
                      <span className="min-w-0 truncate font-mono text-[10.5px]">
                        {fmtStamp(version.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </PanelSection>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-(--dim)">
        {label}
      </span>
      {children}
    </div>
  );
}

function SaveBadge({ state, readOnly }: { state: SaveState; readOnly: boolean }) {
  if (readOnly) {
    return <span className="font-mono text-[10.5px] text-(--dim)">read-only</span>;
  }
  if (state.kind === "error") {
    return (
      <span
        className="max-w-[32ch] truncate font-mono text-[10.5px] text-(--bad)"
        title={state.message}
      >
        not saved — {state.message}
      </span>
    );
  }
  if (state.kind === "saving" || state.kind === "dirty") {
    return <span className="font-mono text-[10.5px] text-(--dim)">saving…</span>;
  }
  if (state.kind === "saved") {
    return <span className="font-mono text-[10.5px] text-(--dim)">saved</span>;
  }
  return null;
}
