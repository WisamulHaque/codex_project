import { OkrModel } from "../models/okrModel";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";

export interface QuarterlyProgress {
  quarter: string;
  progress: number;
  okrs: number;
  focus: string;
  trend: string;
}

export interface YearlyProgress {
  year: number;
  progress: number;
  completed: number;
}

export interface ReportSummary {
  onTrack: number;
  atRisk: number;
  offTrack: number;
  completed: number;
}

interface ReportFilters {
  year?: number;
  team?: string;
  status?: string;
}

interface ReportSnapshot {
  year: number;
  okrs: Array<{
    status: string;
    progress: number;
    category?: string;
    vertical?: string;
    dueDate?: string;
  }>;
}

const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];

function parseDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function normalizeStatusFilter(status?: string) {
  if (!status) {
    return undefined;
  }
  const normalized = status.toLowerCase();
  if (["ontrack", "on_track", "on-track"].includes(normalized)) {
    return "onTrack";
  }
  if (["atrisk", "at_risk", "at-risk"].includes(normalized)) {
    return "atRisk";
  }
  if (["offtrack", "off_track", "off-track"].includes(normalized)) {
    return "offTrack";
  }
  if (normalized === "completed") {
    return "completed";
  }
  return undefined;
}

function getReportYear(input?: number) {
  return input ?? new Date().getFullYear();
}

function getQuarterIndex(date: Date) {
  return Math.floor(date.getMonth() / 3);
}

function buildFocusLabel(items: ReportSnapshot["okrs"]) {
  const counts = new Map<string, number>();
  items.forEach((okr) => {
    const label = okr.category?.trim() || okr.vertical?.trim();
    if (!label) {
      return;
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  if (counts.size === 0) {
    return "Cross-team alignment";
  }

  let topLabel = "";
  let topCount = 0;
  counts.forEach((count, label) => {
    if (count > topCount) {
      topLabel = label;
      topCount = count;
    }
  });

  return topLabel || "Cross-team alignment";
}

function calculateAverageProgress(items: ReportSnapshot["okrs"]) {
  if (!items.length) {
    return 0;
  }
  const total = items.reduce((sum, okr) => sum + (okr.progress ?? 0), 0);
  return Math.round(total / items.length);
}

function calculateSummary(items: ReportSnapshot["okrs"]) {
  const summary: ReportSummary = {
    onTrack: 0,
    atRisk: 0,
    offTrack: 0,
    completed: 0
  };

  items.forEach((okr) => {
    if ((okr.progress ?? 0) >= 100) {
      summary.completed += 1;
    }
    if (okr.status === "onTrack") {
      summary.onTrack += 1;
    }
    if (okr.status === "atRisk") {
      summary.atRisk += 1;
    }
    if (okr.status === "offTrack") {
      summary.offTrack += 1;
    }
  });

  return summary;
}

async function getReportSnapshot(
  filters: ReportFilters,
  options: { includeAllYears?: boolean } = {}
): Promise<ReportSnapshot> {
  const year = getReportYear(filters.year);
  const statusFilter = normalizeStatusFilter(filters.status);
  const teamFilter = filters.team?.trim();

  const query: Record<string, unknown> = {};
  const andConditions: Array<Record<string, unknown>> = [];

  if (!options.includeAllYears) {
    andConditions.push({ dueDate: new RegExp(`^${year}`) });
  }

  if (statusFilter && statusFilter !== "completed") {
    query.status = statusFilter;
  }

  const normalizedTeamFilter = teamFilter?.toLowerCase();
  if (teamFilter && normalizedTeamFilter !== "all teams" && normalizedTeamFilter !== "all departments") {
    const regex = new RegExp(teamFilter, "i");
    andConditions.push({ $or: [{ category: regex }, { vertical: regex }, { owner: regex }, { owners: regex }] });
  }

  if (andConditions.length) {
    query.$and = andConditions;
  }

  logInfo("service", "Loading OKRs for reports");
  const okrs = await OkrModel.find(query).sort({ dueDate: 1 });

  const filtered = okrs
    .map((okr) => ({
      status: okr.status,
      progress: okr.progress ?? 0,
      category: okr.category,
      vertical: okr.vertical,
      dueDate: okr.dueDate
    }))
    .filter((okr) => {
      const date = parseDate(okr.dueDate);
      if (!date) {
        return false;
      }
      if (!options.includeAllYears && date.getFullYear() !== year) {
        return false;
      }
      if (statusFilter === "completed") {
        return (okr.progress ?? 0) >= 100;
      }
      return true;
    });

  return { year, okrs: filtered };
}

export async function getQuarterlyReport(filters: ReportFilters) {
  const snapshot = await getReportSnapshot(filters);
  const quarters: QuarterlyProgress[] = quarterLabels.map((label) => ({
    quarter: label,
    progress: 0,
    okrs: 0,
    focus: "Cross-team alignment",
    trend: "Baseline quarter"
  }));

  snapshot.okrs.forEach((okr) => {
    const date = parseDate(okr.dueDate);
    if (!date) {
      return;
    }
    const index = getQuarterIndex(date);
    if (!quarters[index]) {
      return;
    }
    const existing = quarters[index];
    existing.okrs += 1;
    existing.progress += okr.progress ?? 0;
  });

  quarters.forEach((quarter, index) => {
    const bucketItems = snapshot.okrs.filter((okr) => {
      const date = parseDate(okr.dueDate);
      return date ? getQuarterIndex(date) === index : false;
    });
    const average = calculateAverageProgress(bucketItems);
    quarter.progress = average;
    quarter.focus = buildFocusLabel(bucketItems);

    if (index > 0) {
      const diff = quarter.progress - quarters[index - 1].progress;
      if (diff === 0) {
        quarter.trend = "No change vs last quarter";
      } else if (diff > 0) {
        quarter.trend = `+${diff}% vs last quarter`;
      } else {
        quarter.trend = `${diff}% vs last quarter`;
      }
    }
  });

  const summary = calculateSummary(snapshot.okrs);

  return {
    year: snapshot.year,
    quarters,
    summary
  };
}

export async function getYearlyReport(filters: ReportFilters) {
  const snapshot = await getReportSnapshot(filters, { includeAllYears: true });
  const year = snapshot.year;
  const startYear = year - 4;
  const years: YearlyProgress[] = [];

  for (let y = startYear; y <= year; y += 1) {
    const okrsForYear = snapshot.okrs.filter((okr) => {
      const date = parseDate(okr.dueDate);
      return date ? date.getFullYear() === y : false;
    });
    years.push({
      year: y,
      progress: calculateAverageProgress(okrsForYear),
      completed: okrsForYear.filter((okr) => (okr.progress ?? 0) >= 100).length
    });
  }

  const averageProgress = years.length
    ? Math.round(years.reduce((sum, item) => sum + item.progress, 0) / years.length)
    : 0;
  const highest = years.reduce(
    (best, item) => (item.progress > best.progress ? item : best),
    years[0] ?? { year, progress: 0, completed: 0 }
  );
  const totalCompleted = years.reduce((sum, item) => sum + item.completed, 0);

  return {
    years,
    insights: {
      averageProgress,
      highestMomentumYear: highest.year,
      totalCompleted
    }
  };
}

function buildCsvReport(quarterly: Awaited<ReturnType<typeof getQuarterlyReport>>, yearly: Awaited<ReturnType<typeof getYearlyReport>>) {
  const lines = [
    `Report Year,${quarterly.year}`,
    "",
    "Quarterly Progress",
    "Quarter,Progress,OKRs,Focus,Trend"
  ];

  quarterly.quarters.forEach((quarter) => {
    lines.push(
      `${quarter.quarter},${quarter.progress},${quarter.okrs},"${quarter.focus}","${quarter.trend}"`
    );
  });

  lines.push("", "Yearly Progress", "Year,Progress,Completed");
  yearly.years.forEach((item) => {
    lines.push(`${item.year},${item.progress},${item.completed}`);
  });

  return lines.join("\n");
}

export async function buildReportDownload(filters: ReportFilters, format: string) {
  const normalized = format.toLowerCase();
  const quarterly = await getQuarterlyReport(filters);

  if (normalized === "csv") {
    const yearly = await getYearlyReport(filters);
    const csv = buildCsvReport(quarterly, yearly);
    return {
      buffer: Buffer.from(csv, "utf-8"),
      contentType: "text/csv",
      fileName: `okr-report-${quarterly.year}.csv`
    };
  }

  throw new AppError("Only CSV downloads are supported.", 400);
}
