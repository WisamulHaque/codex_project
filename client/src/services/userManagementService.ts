import { logError, logInfo, logWarn } from "@/utils/logger";
import { fetchWithRetry } from "@/utils/fetchWithRetry";
import { getAuthSession } from "@/utils/authStorage";

export type ApiRole = "admin" | "manager" | "employee";

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: ApiRole;
  department?: string;
  designation?: string;
  manager?: string;
  okrsAssigned?: number;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface ListUsersResponse {
  data: UserSummary[];
  pagination: PaginationMeta;
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

export async function listUsers(params: {
  page: number;
  limit: number;
  search?: string;
  role?: string;
}) {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.role) {
    query.set("role", params.role);
  }

  return request<ListUsersResponse>(`/users?${query.toString()}`);
}

export async function createUser(payload: {
  fullName: string;
  email: string;
  role: ApiRole;
  department?: string;
  designation?: string;
  manager?: string;
}) {
  return request<{ data: UserSummary; message?: string }>("/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function bulkCreateUsers(payload: {
  users: Array<Omit<Parameters<typeof createUser>[0], "role"> & { role?: ApiRole }>;
}) {
  return request<{ data: Array<{ user: UserSummary }>; message?: string }>(
    "/users/bulk",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function updateUser(userId: string, payload: {
  fullName?: string;
  email?: string;
  department?: string;
  designation?: string;
  manager?: string;
}) {
  return request<{ data: UserSummary; message?: string }>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function updateUserRole(userId: string, role: ApiRole) {
  return request<{ data: UserSummary; message?: string }>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role })
  });
}

export async function bulkUpdateRoles(payload: { userIds: string[]; role: ApiRole }) {
  return request<{ message: string }>("/users/roles/bulk", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteUser(userId: string) {
  try {
    return await request<{ message: string }>(`/users/${userId}`, {
      method: "DELETE"
    });
  } catch (error) {
    logWarn("service", "DELETE /users/:id failed, retrying with POST", error);
    return request<{ message: string }>(`/users/${userId}/delete`, {
      method: "POST"
    });
  }
}

export async function bulkDeleteUsers(payload: { userIds: string[] }) {
  try {
    return await request<{ message: string }>("/users/bulk", {
      method: "DELETE",
      body: JSON.stringify(payload)
    });
  } catch (error) {
    logWarn("service", "DELETE /users/bulk failed, retrying with POST", error);
    return request<{ message: string }>("/users/bulk-delete", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
}
