type LogContext = "client" | "ui" | "service" | "adapter";

function formatMessage(context: LogContext, message: string) {
  return `[${context}] ${message}`;
}

export function logInfo(context: LogContext, message: string) {
  console.info(formatMessage(context, message));
}

export function logWarn(context: LogContext, message: string) {
  console.warn(formatMessage(context, message));
}

export function logError(context: LogContext, message: string, error?: unknown) {
  console.error(formatMessage(context, message), error);
}
