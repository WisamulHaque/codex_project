import { logError, logInfo } from "@/utils/logger";
import { getAuthSession, saveAuthSession } from "@/utils/authStorage";
import type { AuthUser } from "@/services/authService";
import { fetchWithRetry } from "@/utils/fetchWithRetry";

interface UserResponse {
  data: AuthUser;
  message?: string;
}

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

export async function getCurrentUser() {
  const response = await request<UserResponse>("/users/me");
  return response.data;
}

export async function updateProfile(payload: {
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
}) {
  const response = await request<UserResponse>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

  const session = getAuthSession();
  if (session) {
    saveAuthSession({ ...session, user: response.data });
  }

  return response;
}

export async function updatePassword(payload: { oldPassword: string; newPassword: string }) {
  return request<{ message: string }>("/users/me/password", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function updateAvatar(payload: { avatarUrl: string }) {
  const response = await request<UserResponse>("/users/me/avatar", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const session = getAuthSession();
  if (session) {
    saveAuthSession({ ...session, user: response.data });
  }

  return response;
}
