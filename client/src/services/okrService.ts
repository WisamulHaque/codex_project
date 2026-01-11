import { mapOkrDtoToOkr } from "@/adapters/okrAdapter";
import { okrMockData } from "@/mockData/okrMockData";
import { KeyResultStatus, Okr, OkrDto } from "@/features/okr/okrTypes";
import { getAuthSession } from "@/utils/authStorage";
import { logError, logInfo, logWarn } from "@/utils/logger";
import { fetchWithRetry } from "@/utils/fetchWithRetry";

const baseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:4000/api/v1" : "/api/v1");

const useMocks = import.meta.env.VITE_USE_MOCKS === "true";

async function simulateNetworkDelay() {
  await new Promise((resolve) => setTimeout(resolve, 600));
}

// Service layer to keep API interaction and data mapping consistent.
export async function getOkrs(params?: {
  search?: string;
  status?: string;
  owner?: string;
  category?: string;
  vertical?: string;
  page?: number;
  limit?: number;
}): Promise<Okr[]> {
  logInfo("service", "Fetching OKRs");

  if (useMocks) {
    await simulateNetworkDelay();
    logWarn("service", "Using mock OKR data");
    return okrMockData.map(mapOkrDtoToOkr);
  }

  const query = new URLSearchParams();
  if (params?.search) {
    query.set("search", params.search);
  }
  if (params?.status) {
    query.set("status", params.status);
  }
  if (params?.owner) {
    query.set("owner", params.owner);
  }
  if (params?.category) {
    query.set("category", params.category);
  }
  if (params?.vertical) {
    query.set("vertical", params.vertical);
  }
  if (params?.page) {
    query.set("page", String(params.page));
  }
  if (params?.limit) {
    query.set("limit", String(params.limit));
  }

  const response = await request<{ data: OkrDto[] }>(`/okrs${query.toString() ? `?${query.toString()}` : ""}`);
  return response.data.map(mapOkrDtoToOkr);
}

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

export async function getOkrById(id: string) {
  const response = await request<{ data: OkrDto }>(`/okrs/${id}`);
  return mapOkrDtoToOkr(response.data);
}

export async function createOkr(payload: OkrDto) {
  const response = await request<{ data: OkrDto }>(`/okrs`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapOkrDtoToOkr(response.data);
}

export async function updateOkr(id: string, payload: Partial<OkrDto>) {
  const response = await request<{ data: OkrDto }>(`/okrs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return mapOkrDtoToOkr(response.data);
}

export async function deleteOkr(id: string) {
  return request<{ message: string }>(`/okrs/${id}`, {
    method: "DELETE"
  });
}

export async function cloneOkr(id: string, payload: Partial<OkrDto>) {
  const response = await request<{ data: OkrDto }>(`/okrs/${id}/clone`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapOkrDtoToOkr(response.data);
}

export async function updateKeyResultStatus(okrId: string, keyResultId: string, status: KeyResultStatus) {
  const response = await request<{ data: OkrDto }>(`/okrs/${okrId}/key-results/${keyResultId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  return mapOkrDtoToOkr(response.data);
}

export async function updateOkrOwners(okrId: string, owners: string[]) {
  const response = await request<{ data: OkrDto }>(`/okrs/${okrId}/owners`, {
    method: "PATCH",
    body: JSON.stringify({ owners })
  });
  return mapOkrDtoToOkr(response.data);
}
