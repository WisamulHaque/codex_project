import type { NotificationDto, NotificationPreferences } from "@/features/notifications/notificationTypes";
import { getAuthSession } from "@/utils/authStorage";
import { logError, logInfo } from "@/utils/logger";
import { fetchWithRetry } from "@/utils/fetchWithRetry";

const baseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:4000/api/v1" : "/api/v1");

function getAuthHeader() {
  const session = getAuthSession();
  if (!session?.accessToken) {
    throw new Error("You are not authenticated.");
  }
  return { Authorization: `Bearer ${session.accessToken}` };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${baseUrl}${path}`;
  const method = options?.method ?? "GET";
  logInfo("service", `${method} ${url}`);

  try {
    const response = await fetchWithRetry(
      url,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...getAuthHeader(),
          ...(options?.headers ?? {})
        },
        ...options
      },
      { retries: method === "GET" ? 2 : 0 }
    );

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as T) : ({} as T);

    if (!response.ok) {
      const message = (payload as { message?: string })?.message ?? `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    logError("service", `Request failed for ${url}`, error);
    throw error;
  }
}

export async function getNotifications() {
  const response = await request<{ data: NotificationDto[] }>("/notifications");
  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await request<{ data: { count: number } }>("/notifications/unread-count");
  return response.data.count;
}

export async function markNotificationsRead(ids?: string[], markAll?: boolean) {
  const response = await request<{ data: { updatedCount: number }; message: string }>("/notifications/read", {
    method: "PATCH",
    body: JSON.stringify({ ids, markAll })
  });
  return response.data.updatedCount;
}

export async function markNotificationRead(id: string) {
  const response = await request<{ data: NotificationDto }>("/notifications/" + id + "/read", {
    method: "PATCH"
  });
  return response.data;
}

export async function updateNotificationPreferences(payload: NotificationPreferences) {
  const response = await request<{ data: NotificationPreferences }>(
    "/notifications/preferences",
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    }
  );
  return response.data;
}
