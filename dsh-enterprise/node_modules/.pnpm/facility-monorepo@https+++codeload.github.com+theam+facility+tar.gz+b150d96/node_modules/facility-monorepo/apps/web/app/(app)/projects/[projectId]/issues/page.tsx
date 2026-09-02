import { redirect } from "next/navigation";

/** Issues became Stories — keep old links and muscle memory working. */
export default async function LegacyIssuesRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const [{ projectId }, { stage }] = await Promise.all([params, searchParams]);
  redirect(`/projects/${projectId}/stories${stage ? `?stage=${stage}` : ""}`);
}
