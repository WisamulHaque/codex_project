import { logError, logInfo } from "@/utils/logger";
import { fetchWithRetry } from "@/utils/fetchWithRetry";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: string;
  designation?: string;
  manager?: string;
  avatarUrl?: string;
  isEmailVerified?: boolean;
  notificationPreferences?: {
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
}

export interface AuthResponse {
  data: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  verificationToken?: string;
  resetToken?: string;
}

interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface GooglePayload {
  idToken: string;
}

const baseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:4000/api/v1" : "/api/v1");

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

export function registerUser(payload: RegisterPayload) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function loginUser(payload: LoginPayload) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function googleLogin(payload: GooglePayload) {
  return request<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function resendVerification(payload: { email: string }) {
  return request<AuthResponse>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function verifyEmail(payload: { token: string }) {
  return request<AuthResponse>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function forgotPassword(payload: { email: string }) {
  return request<AuthResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function resetPassword(payload: { token: string; newPassword: string }) {
  return request<AuthResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function refreshSession(payload: { refreshToken: string }) {
  return request<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function logoutSession(payload: { refreshToken: string }) {
  return request<{ message: string }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
