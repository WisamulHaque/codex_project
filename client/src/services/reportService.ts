import type { QuarterlyReportResponse, YearlyReportResponse } from "@/features/reports/reportTypes";
import { getAuthSession } from "@/utils/authStorage";
import { logError, logInfo } from "@/utils/logger";
import { fetchWithRetry } from "@/utils/fetchWithRetry";

export type ReportFormat = "csv";

interface ReportFilters {
  year?: number;
  team?: string;
  status?: string;
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

function buildQuery(filters?: ReportFilters) {
  const query = new URLSearchParams();
  if (filters?.year) {
    query.set("year", filters.year.toString());
  }
  if (filters?.team) {
    query.set("team", filters.team);
  }
  if (filters?.status) {
    query.set("status", filters.status);
  }
  return query.toString();
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

export async function getQuarterlyReport(filters?: ReportFilters) {
  const query = buildQuery(filters);
  const response = await request<{ data: QuarterlyReportResponse }>(`/reports/quarterly${query ? `?${query}` : ""}`);
  return response.data;
}

export async function getYearlyReport(filters?: ReportFilters) {
  const query = buildQuery(filters);
  const response = await request<{ data: YearlyReportResponse }>(`/reports/yearly${query ? `?${query}` : ""}`);
  return response.data;
}

export async function downloadReport(format: ReportFormat, filters?: ReportFilters) {
  const query = buildQuery(filters);
  const url = `${baseUrl}/reports/download?format=${format}${query ? `&${query}` : ""}`;
  logInfo("service", `GET ${url}`);

  const response = await fetchWithRetry(
    url,
    {
      headers: {
        ...getAuthHeader()
      }
    },
    { retries: 2 }
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  let fileName = `okr-report.${format}`;
  if (disposition) {
    const match = disposition.match(/filename=\"(.+?)\"/);
    if (match?.[1]) {
      fileName = match[1];
    }
  }

  return { blob, fileName };
}
