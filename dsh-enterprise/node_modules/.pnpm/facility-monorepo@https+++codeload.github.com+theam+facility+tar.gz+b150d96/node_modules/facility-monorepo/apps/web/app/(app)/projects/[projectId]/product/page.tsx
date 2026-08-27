import { Eyebrow } from "@facility/ui";
import { Suspense } from "react";
import { ErrorNotice, Offline } from "@/components/offline";
import { ProductWorkspace } from "@/components/product/workspace";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { api } from "@/lib/api";
import type { KbDecision, KbEntry, KbSpace } from "@/lib/kb";
import { ProductTabs } from "./tabs";

export const metadata = { title: "product" };

type IntakeTrigger = { type?: string; entryId?: string };

export default async function ProductPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [space, entries, decisions, runs, me] = await Promise.all([
    api.kbSpace(projectId),
    api.kbEntries(projectId),
    api.kbDecisions(projectId),
    api.runs(projectId),
    api.me(),
  ]);

  if (!space.ok && space.offline) return <Offline />;

  const canWriteKb =
    me.ok && me.data.permissions.some((p) => p === "*" || p === "kb:write" || p === "kb:*");

  // Signals link to the review run their intake dispatched.
  const signalRuns: Record<string, string> = {};
  for (const run of runs.ok ? runs.data : []) {
    const trigger = run.trigger as IntakeTrigger | null;
    if (trigger?.type === "kb_intake" && typeof trigger.entryId === "string") {
      signalRuns[trigger.entryId] ??= run.id;
    }
  }

  const kbSpace = (space.ok ? space.data : { charterMd: "", activeMd: "" }) as KbSpace;
  const kbEntries = (entries.ok ? entries.data : []) as unknown as KbEntry[];
  const kbDecisions = (decisions.ok ? decisions.data : []) as unknown as KbDecision[];

  return (
    // App-shell tab: fills the work area edge to edge (see main.app-main).
    <div className="main-bleed flex h-full min-h-0 flex-col">
      <LiveRefresh seconds={60} />
      <div className="border-b border-(--line) px-5 pt-4 sm:px-6">
        <Eyebrow>product</Eyebrow>
        <div className="mt-2">
          <ProductTabs />
        </div>
      </div>

      {!space.ok || !entries.ok ? (
        <div className="p-5">
          <ErrorNotice
            message={`Couldn't load the knowledge base — ${!space.ok ? space.message : entries.ok ? "" : entries.message}`}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <Suspense>
            <ProductWorkspace
              projectId={projectId}
              space={kbSpace}
              entries={kbEntries}
              decisions={kbDecisions}
              signalRuns={signalRuns}
              canWrite={canWriteKb}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
