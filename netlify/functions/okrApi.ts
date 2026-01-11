import type { Handler } from "@netlify/functions";
import serverless from "serverless-http";
import { createServer } from "../../server/src/app";
import { connectDatabase } from "../../server/src/config/database";
import { loadEnv } from "../../server/src/config/env";
import { logInfo } from "../../server/src/utils/logger";

const app = createServer();
const serverlessHandler = serverless(app);
let isInitialized = false;

// Netlify serverless entry for the Express API.
export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  loadEnv();

  if (!isInitialized) {
    await connectDatabase();
    isInitialized = true;
    logInfo("server", "Serverless API initialized");
  }

  return serverlessHandler(event, context);
};
