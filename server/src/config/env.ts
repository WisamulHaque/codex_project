import { config } from "dotenv";
import { logInfo, logWarn } from "../utils/logger";

let envLoaded = false;

// Load .env once for local development.
export function loadEnv() {
  if (envLoaded) {
    return;
  }

  config();
  envLoaded = true;
  logInfo("config", "Environment variables loaded");
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string, fallback = ""): string {
  const value = process.env[name];
  if (!value) {
    logWarn("config", `Missing optional environment variable: ${name}`);
    return fallback;
  }
  return value;
}
