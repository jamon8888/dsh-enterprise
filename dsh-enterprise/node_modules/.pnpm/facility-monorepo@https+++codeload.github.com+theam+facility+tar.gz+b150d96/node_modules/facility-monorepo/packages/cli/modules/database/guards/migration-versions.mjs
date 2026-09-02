// facility module: database
//
// Two migrations with the same version prefix apply in undefined order — and
// on some stacks, silently skip. Collisions happen exactly when two branches
// (or two agents) scaffold migrations the same day and both merge. This guard
// fails the build the moment both exist on one branch.
import { readdirSync } from "node:fs";

const MIGRATION_DIRS = ["migrations", "supabase/migrations", "db/migrations", "prisma/migrations"];

export default {
  name: "migration-versions",
  description: "no two migration files share a version prefix",
  run() {
    const violations = [];
    for (const dir of MIGRATION_DIRS) {
      let files;
      try {
        files = readdirSync(dir).filter((f) => /^\d/.test(f));
      } catch {
        continue;
      }
      const byVersion = new Map();
      for (const file of files) {
        const version = file.match(/^(\d+)/)?.[1];
        if (!version) continue;
        if (!byVersion.has(version)) byVersion.set(version, []);
        byVersion.get(version).push(file);
      }
      for (const [version, group] of byVersion) {
        if (group.length > 1) {
          violations.push({
            file: `${dir}/${group[1]}`,
            message: `version ${version} collides across: ${group.join(", ")} — regenerate with a fresh timestamp`,
          });
        }
      }
    }
    return violations;
  },
};
