import { Comment } from "@/features/comments/commentTypes";
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

export async function getCommentsByOkr(okrId: string) {
  const response = await request<{ data: Comment[] }>(`/okrs/${okrId}/comments`);
  return response.data;
}

export async function createComment(okrId: string, message: string) {
  const response = await request<{ data: Comment }>(`/okrs/${okrId}/comments`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
  return response.data;
}

export async function updateComment(commentId: string, message: string, replyId?: string) {
  const response = await request<{ data: Comment }>(`/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ message, replyId })
  });
  return response.data;
}

export async function deleteComment(commentId: string, replyId?: string) {
  const response = await request<{ data?: Comment; message?: string }>(`/comments/${commentId}`, {
    method: "DELETE",
    body: JSON.stringify({ replyId })
  });
  return response;
}

export async function createReply(commentId: string, message: string) {
  const response = await request<{ data: Comment }>(`/comments/${commentId}/replies`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
  return response.data;
}
