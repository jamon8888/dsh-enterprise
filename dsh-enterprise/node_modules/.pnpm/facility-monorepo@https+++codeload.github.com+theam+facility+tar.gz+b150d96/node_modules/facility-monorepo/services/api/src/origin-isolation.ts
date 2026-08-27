import { getDomain } from "tldts";

export function registeredSite(hostname: string) {
  return getDomain(hostname, { allowPrivateDomains: true });
}
