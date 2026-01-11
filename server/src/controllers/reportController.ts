import type { Request, Response } from "express";
import { buildReportDownload, getQuarterlyReport, getYearlyReport } from "../services/reportService";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";

function parseYear(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseFilters(request: Request) {
  const year = parseYear(request.query.year);
  const team = typeof request.query.team === "string" ? request.query.team : undefined;
  const status = typeof request.query.status === "string" ? request.query.status : undefined;
  return { year, team, status };
}

export async function getQuarterlyReports(request: Request, response: Response) {
  logInfo("route", "GET /reports/quarterly");
  const report = await getQuarterlyReport(parseFilters(request));
  return response.status(200).json({ data: report });
}

export async function getYearlyReports(request: Request, response: Response) {
  logInfo("route", "GET /reports/yearly");
  const report = await getYearlyReport(parseFilters(request));
  return response.status(200).json({ data: report });
}

export async function downloadReport(request: Request, response: Response) {
  logInfo("route", "GET /reports/download");
  const format = typeof request.query.format === "string" ? request.query.format : undefined;
  if (!format) {
    throw new AppError("Report format is required.", 400);
  }

  const { buffer, contentType, fileName } = await buildReportDownload(parseFilters(request), format);
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return response.status(200).send(buffer);
}
