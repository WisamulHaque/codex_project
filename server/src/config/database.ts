import mongoose from "mongoose";
import { getRequiredEnv, getOptionalEnv } from "./env";
import { logError, logInfo } from "../utils/logger";

let isConnected = false;

// Reuse a single MongoDB connection to support serverless and local dev.
export async function connectDatabase() {
  if (isConnected) {
    return;
  }

  const mongoUri = getRequiredEnv("MONGODB_URI");
  const dbName = getOptionalEnv("MONGODB_DB");

  try {
    await mongoose.connect(mongoUri, dbName ? { dbName } : undefined);
    isConnected = true;
    logInfo("db", "MongoDB connection established");
  } catch (error) {
    logError("db", "Failed to connect to MongoDB", error);
    throw error;
  }
}

export async function disconnectDatabase() {
  if (!isConnected) {
    return;
  }

  await mongoose.disconnect();
  isConnected = false;
  logInfo("db", "MongoDB connection closed");
}
