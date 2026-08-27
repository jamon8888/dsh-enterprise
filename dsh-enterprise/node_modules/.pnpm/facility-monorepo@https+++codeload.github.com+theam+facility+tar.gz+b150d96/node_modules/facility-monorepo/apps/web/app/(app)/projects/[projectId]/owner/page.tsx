import { redirect } from "next/navigation";

/** The Owner surface became the Product tab — keep old links working. */
export default async function OwnerRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/product`);
}
