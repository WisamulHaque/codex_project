import { createServer } from "./app";
import { connectDatabase } from "./config/database";
import { getOptionalEnv, loadEnv } from "./config/env";
import { logError, logInfo } from "./utils/logger";

async function startServer() {
  loadEnv();
  await connectDatabase();
  const port = Number(getOptionalEnv("PORT", "4000"));
  const app = createServer();

  app.listen(port, () => {
    logInfo("server", `OKR API listening on port ${port}`);
  });
}

startServer().catch((error) => {
  logError("server", "Failed to start server", error);
  process.exit(1);
});
