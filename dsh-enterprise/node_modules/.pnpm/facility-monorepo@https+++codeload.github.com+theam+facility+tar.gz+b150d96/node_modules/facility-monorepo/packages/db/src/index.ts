import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { withOrg } from "./scoped.js";

export * from "./audit.js";
export * from "./deploy.js";
export * from "./migrate.js";
export * from "./schema.js";
export * from "./scoped.js";
export * from "./seed.js";

export type FacilityDb = ReturnType<typeof createDb>["db"];

export function createDb(connectionString: string, options: { max?: number } = {}) {
  const client = postgres(connectionString, { max: options.max ?? 10 });
  const db = drizzle(client, { schema });
  return { db, client, withOrg: (orgId: string) => withOrg(db, orgId) };
}
