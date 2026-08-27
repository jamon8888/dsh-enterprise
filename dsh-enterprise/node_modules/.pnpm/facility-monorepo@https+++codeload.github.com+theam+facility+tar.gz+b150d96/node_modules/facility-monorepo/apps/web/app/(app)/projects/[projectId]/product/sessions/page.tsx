import { Eyebrow } from "@facility/ui";
import { Suspense } from "react";
import { Offline } from "@/components/offline";
import { SessionsWorkspace, type SessionThread } from "@/components/product/sessions-workspace";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { untypedApi } from "@/lib/api";
import { ProductTabs } from "../tabs";

export const metadata = { title: "sessions" };

type ThreadRow = SessionThread & { kind?: string };

export default async function ProductSessionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const conversations = await untypedApi<ThreadRow[]>(
    "GET",
    `/v1/projects/${projectId}/conversations`,
  );
  if (!conversations.ok && conversations.offline) return <Offline />;

  const threads = (conversations.ok ? conversations.data : []).filter(
    (thread) => thread.kind === "assistant",
  );

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

      <div className="min-h-0 flex-1">
        <Suspense>
          <SessionsWorkspace projectId={projectId} threads={threads} />
        </Suspense>
      </div>
    </div>
  );
}
