import { logInfo, logError } from "@/utils/logger";
import { fetchWithRetry } from "@/utils/fetchWithRetry";

interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T, U>(path: string, payload: T): Promise<U>;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

// Factory pattern for creating a typed API client.
export function createApiClient({ baseUrl, defaultHeaders = {} }: ApiClientConfig): ApiClient {
  logInfo("service", `Creating API client for ${baseUrl}`);

  return {
    async get<T>(path: string) {
      const url = `${baseUrl}${path}`;
      logInfo("service", `GET ${url}`);

      try {
        const response = await fetchWithRetry(
          url,
          {
            headers: {
              Accept: "application/json",
              ...defaultHeaders
            }
          },
          { retries: 2 }
        );

        return await handleResponse<T>(response);
      } catch (error) {
        logError("service", `GET ${url} failed`, error);
        throw error;
      }
    },
    async post<T, U>(path: string, payload: T) {
      const url = `${baseUrl}${path}`;
      logInfo("service", `POST ${url}`);

      try {
        const response = await fetchWithRetry(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...defaultHeaders
            },
            body: JSON.stringify(payload)
          },
          { retries: 0 }
        );

        return await handleResponse<U>(response);
      } catch (error) {
        logError("service", `POST ${url} failed`, error);
        throw error;
      }
    }
  };
}
