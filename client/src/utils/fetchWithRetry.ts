export interface RetryOptions {
  retries?: number;
  retryDelayMs?: number;
  shouldRetry?: (response?: Response, error?: unknown) => boolean;
}

const defaultDelayMs = 500;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultShouldRetry(response?: Response, error?: unknown) {
  if (error) {
    return true;
  }
  if (!response) {
    return false;
  }
  return response.status >= 500 || response.status === 429;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const retries = options?.retries ?? 0;
  const retryDelayMs = options?.retryDelayMs ?? defaultDelayMs;
  const shouldRetry = options?.shouldRetry ?? defaultShouldRetry;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const response = await fetch(input, init);
      if (!shouldRetry(response)) {
        return response;
      }
      lastError = new Error(`Request failed with status ${response.status}`);
    } catch (error) {
      if (!shouldRetry(undefined, error)) {
        throw error;
      }
      lastError = error;
    }

    if (attempt === retries) {
      break;
    }

    await wait(retryDelayMs * Math.pow(2, attempt));
    attempt += 1;
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Request failed after retries.");
}
