import { databaseDeployExitCode, deployDatabase } from "../deploy.js";

try {
  await deployDatabase();
} catch (error) {
  const exitCode = databaseDeployExitCode(error);
  console.error(
    JSON.stringify({
      event: "facility.db.deploy.exit",
      exitCode,
      errorCode:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "database_deploy_failed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = exitCode;
}
