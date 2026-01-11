import { getOptionalEnv } from "../config/env";
import { logError, logInfo, logWarn } from "../utils/logger";

interface SlackMessageInput {
  text: string;
}

const slackWebhookUrl = getOptionalEnv("SLACK_WEBHOOK_URL");
const slackChannel = getOptionalEnv("SLACK_CHANNEL");

export async function sendSlackMessage(payload: SlackMessageInput) {
  if (!slackWebhookUrl) {
    logWarn("slack", "Slack webhook not configured");
    return;
  }

  if (typeof fetch !== "function") {
    logWarn("slack", "Fetch API is not available for Slack notifications");
    return;
  }

  try {
    const body = {
      text: payload.text,
      ...(slackChannel ? { channel: slackChannel } : {})
    };

    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logWarn("slack", `Slack webhook responded with ${response.status}: ${errorText}`);
      return;
    }

    logInfo("slack", "Slack notification sent");
  } catch (error) {
    logError("slack", "Failed to send Slack notification", error);
  }
}
