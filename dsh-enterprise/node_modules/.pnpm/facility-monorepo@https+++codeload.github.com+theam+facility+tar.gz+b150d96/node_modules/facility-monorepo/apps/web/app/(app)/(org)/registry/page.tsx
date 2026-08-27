import { redirect } from "next/navigation";

/** Legacy registry URLs redirect to the Harness. */
export default function LegacyRegistryRedirect() {
  redirect("/harness");
}
