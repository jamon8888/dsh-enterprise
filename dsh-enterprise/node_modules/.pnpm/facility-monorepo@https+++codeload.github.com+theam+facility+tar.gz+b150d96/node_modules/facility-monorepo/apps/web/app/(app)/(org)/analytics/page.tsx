import { redirect } from "next/navigation";

/** Analytics live in the portfolio and project overviews. */
export default function LegacyAnalyticsRedirect() {
  redirect("/projects");
}
