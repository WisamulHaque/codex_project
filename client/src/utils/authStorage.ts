import type { AuthUser } from "@/services/authService";

const ACCESS_TOKEN_KEY = "okr_access_token";
const REFRESH_TOKEN_KEY = "okr_refresh_token";
const USER_KEY = "okr_user";
const AUTH_EVENT = "auth:updated";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function getAuthSession(): AuthSession | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);

  if (!accessToken || !refreshToken || !rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as AuthUser;
    return { accessToken, refreshToken, user };
  } catch (_error) {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function onAuthSessionChange(handler: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}
