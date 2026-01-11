import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import type {
  QuarterlyProgress,
  ReportSummary,
  YearlyProgress
} from "@/features/reports/reportTypes";
import { downloadReport, getQuarterlyReport, getYearlyReport } from "@/services/reportService";
import { logError, logInfo } from "@/utils/logger";

const yearOptions = ["2026", "2025", "2024", "2023", "2022"];
const teamOptions = [
  "All Departments",
  "Backend",
  "Frontend",
  "QA",
  "HR",
  "DevOps",
  "Ops",
  "AI/ML",
  "General"
];
const statusOptions = ["All Statuses", "On Track", "At Risk", "Off Track", "Completed"];
const quarterOptions = ["Q1", "Q2", "Q3", "Q4"];

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const buildSummaryCards = (summary: ReportSummary) => [
  {
    label: "OKRs on Track",
    value: summary.onTrack.toString(),
    detail: "Based on selected filters",
    trend: "positive"
  },
  {
    label: "At Risk",
    value: summary.atRisk.toString(),
    detail: "Based on selected filters",
    trend: "negative"
  },
  {
    label: "Off Track",
    value: summary.offTrack.toString(),
    detail: "Based on selected filters",
    trend: "negative"
  },
  {
    label: "Completed",
    value: summary.completed.toString(),
    detail: "Based on selected filters",
    trend: "positive"
  }
];

const getProgressTone = (value: number) => {
  if (value >= 75) {
    return "reportBarStrong";
  }
  if (value >= 60) {
    return "reportBarModerate";
  }
  return "reportBarRisk";
};

export default function ReportsView() {
  const [selectedYear, setSelectedYear] = useState(yearOptions[0]);
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[2]);
  const [selectedTeam, setSelectedTeam] = useState(teamOptions[0]);
  const [selectedStatus, setSelectedStatus] = useState(statusOptions[0]);
  const [appliedFilters, setAppliedFilters] = useState({
    year: yearOptions[0],
    team: teamOptions[0],
    status: statusOptions[0]
  });
  const [quarterlyProgress, setQuarterlyProgress] = useState<QuarterlyProgress[]>([]);
  const [yearlyProgress, setYearlyProgress] = useState<YearlyProgress[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    onTrack: 0,
    atRisk: 0,
    offTrack: 0,
    completed: 0
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const selectedQuarterData =
    quarterlyProgress.find((item) => item.quarter === selectedQuarter) ??
    quarterlyProgress[0] ?? {
      quarter: selectedQuarter,
      progress: 0,
      okrs: 0,
      focus: "No data",
      trend: "No data"
    };
  const quarterlyChart = useMemo(() => {
    const labels = quarterlyProgress.length
      ? quarterlyProgress.map((item) => item.quarter)
      : quarterOptions;

    const tones = labels.map((label) => {
      const progress = quarterlyProgress.find((item) => item.quarter === label)?.progress ?? 0;
      return getProgressTone(progress);
    });

    const palette: Record<string, string> = {
      reportBarStrong: "rgba(34, 197, 94, 0.85)",
      reportBarModerate: "rgba(59, 130, 246, 0.85)",
      reportBarRisk: "rgba(249, 115, 22, 0.85)"
    };

    const backgroundColors = labels.map((label, index) => {
      const tone = palette[tones[index]] ?? palette.reportBarModerate;
      return label === selectedQuarter ? "rgba(96, 165, 250, 0.95)" : tone;
    });

    const borderColors = labels.map((label) =>
      label === selectedQuarter ? "rgba(147, 197, 253, 0.95)" : "rgba(15, 23, 42, 0.2)"
    );

    return {
      labels,
      data: {
        labels,
        datasets: [
          {
            label: "Completion",
            data: labels.map((label) => {
              return quarterlyProgress.find((item) => item.quarter === label)?.progress ?? 0;
            }),
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: labels.map((label) => (label === selectedQuarter ? 2 : 0)),
            borderRadius: 8
          }
        ]
      }
    };
  }, [quarterlyProgress, selectedQuarter]);

  const quarterlyOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { parsed: { y: number } }) => `${context.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "rgba(148, 163, 184, 0.9)", font: { size: 12 } }
        },
        y: {
          suggestedMax: 100,
          grid: { color: "rgba(148, 163, 184, 0.15)" },
          ticks: { color: "rgba(148, 163, 184, 0.9)", font: { size: 12 } }
        }
      }
    } as const;
  }, []);

  const yearlyChart = useMemo(() => {
    const labels = yearlyProgress.length
      ? yearlyProgress.map((item) => item.year.toString())
      : yearOptions.slice(0, 4);

    return {
      labels,
      data: {
        labels,
        datasets: [
          {
            label: "Progress",
            data: labels.map((label) => {
              const year = Number(label);
              return yearlyProgress.find((item) => item.year === year)?.progress ?? 0;
            }),
            borderColor: "rgba(96, 165, 250, 0.9)",
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            tension: 0.35,
            fill: true,
            pointBackgroundColor: "rgba(191, 219, 254, 0.9)",
            pointBorderColor: "rgba(30, 58, 138, 0.9)",
            pointRadius: 4
          }
        ]
      }
    };
  }, [yearlyProgress]);

  const yearlyOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: { parsed: { y: number } }) => `${context.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "rgba(148, 163, 184, 0.9)", font: { size: 12 } }
        },
        y: {
          suggestedMax: 100,
          grid: { color: "rgba(148, 163, 184, 0.15)" },
          ticks: { color: "rgba(148, 163, 184, 0.9)", font: { size: 12 } }
        }
      }
    } as const;
  }, []);

  const buildFilters = (overrides?: Partial<{ year: string; team: string; status: string }>) => {
    const yearLabel = overrides?.year ?? appliedFilters.year;
    const team = overrides?.team ?? appliedFilters.team;
    const status = overrides?.status ?? appliedFilters.status;
    const year = Number.parseInt(yearLabel, 10);

    const statusMap: Record<string, string> = {
      "On Track": "onTrack",
      "At Risk": "atRisk",
      "Off Track": "offTrack",
      Completed: "completed"
    };

    return {
      year,
      team: team === "All Departments" ? undefined : team,
      status: status === "All Statuses" ? undefined : statusMap[status] ?? status.toLowerCase()
    };
  };

  const loadReports = async (filters = buildFilters(), toast?: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [quarterly, yearly] = await Promise.all([
        getQuarterlyReport(filters),
        getYearlyReport(filters)
      ]);
      setQuarterlyProgress(quarterly.quarters);
      setYearlyProgress(yearly.years);
      setSummary(quarterly.summary);
      if (toast) {
        setToastMessage(toast);
      }
    } catch (error) {
      logError("ui", "Failed to load reports", error);
      setErrorMessage("Unable to load reports right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReports(buildFilters(appliedFilters));
  }, [appliedFilters]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadReports(buildFilters());
    }, 60000);

    return () => window.clearInterval(interval);
  }, [appliedFilters]);

  const handleApplyFilters = () => {
    logInfo("ui", "Applying report filters");
    const nextFilters = {
      year: selectedYear,
      team: selectedTeam,
      status: selectedStatus
    };
    setAppliedFilters(nextFilters);
    setToastMessage("Filters applied to reports.");
  };

  const handleResetFilters = () => {
    const nextYear = yearOptions[0];
    const nextQuarter = quarterOptions[2];
    const nextTeam = teamOptions[0];
    const nextStatus = statusOptions[0];
    setSelectedYear(nextYear);
    setSelectedQuarter(nextQuarter);
    setSelectedTeam(nextTeam);
    setSelectedStatus(nextStatus);
    const nextFilters = { year: nextYear, team: nextTeam, status: nextStatus };
    setAppliedFilters(nextFilters);
    setToastMessage("Filters reset.");
  };

  const handleDownload = () => {
    setIsLoading(true);
    logInfo("ui", "Downloading CSV report");
    const filters = buildFilters();
    const download = async () => {
      try {
        const { blob, fileName } = await downloadReport("csv", filters);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
        setToastMessage("CSV report download started.");
      } catch (error) {
        logError("ui", "Failed to download report", error);
        setToastMessage("Unable to download report right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void download();
  };

  return (
    <section className="pageSection">
      <div className="sectionHeader">
        <div>
          <h1>Reports</h1>
          <p className="muted">Track quarterly and yearly OKR performance in one view.</p>
        </div>
        <div className="sectionActions">
          <Button variant="secondary" type="button" onClick={handleDownload}>
            Download CSV
          </Button>
        </div>
      </div>

      <div className="card reportFilters">
        <div className="reportFilterRow">
          <div className="inputField">
            <label htmlFor="reportYear">Report Year</label>
            <select
              id="reportYear"
              className="inputControl"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="inputField">
            <label htmlFor="reportQuarter">Quarter</label>
            <select
              id="reportQuarter"
              className="inputControl"
              value={selectedQuarter}
              onChange={(event) => setSelectedQuarter(event.target.value)}
            >
              {quarterOptions.map((quarter) => (
                <option key={quarter} value={quarter}>
                  {quarter}
                </option>
              ))}
            </select>
          </div>
          <div className="inputField">
            <label htmlFor="reportTeam">Department</label>
            <select
              id="reportTeam"
              className="inputControl"
              value={selectedTeam}
              onChange={(event) => setSelectedTeam(event.target.value)}
            >
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>
          <div className="inputField">
            <label htmlFor="reportStatus">Status</label>
            <select
              id="reportStatus"
              className="inputControl"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="reportFilterSummary">
          <span>Active filters:</span>
          <span>{selectedYear}</span>
          <span>{selectedQuarter}</span>
          <span>{selectedTeam}</span>
          <span>{selectedStatus}</span>
        </div>
        <div className="reportFilterActions">
          <Button variant="secondary" type="button" onClick={handleResetFilters}>
            Reset
          </Button>
          <Button type="button" onClick={handleApplyFilters}>
            Apply Filters
          </Button>
        </div>
      </div>

      <div className="reportSummaryGrid">
        {buildSummaryCards(summary).map((card) => (
          <div key={card.label} className="card reportStatCard">
            <p className="caption">{card.label}</p>
            <div className="reportStatValue">{card.value}</div>
            <div
              className={`reportStatMeta ${
                card.trend === "negative" ? "reportStatTrendNegative" : "reportStatTrendPositive"
              }`}
            >
              <span>{card.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="reportGrid">
        <div className="card reportChartCard">
          <div className="reportChartHeader">
            <div>
              <h2>Quarterly Progress</h2>
              <p className="muted">Objective completion by quarter for {selectedYear}.</p>
            </div>
            <span className="caption">Focus: {selectedQuarterData.focus}</span>
          </div>
          <div className="reportChartCanvas">
            <Bar
              data={quarterlyChart.data}
              options={quarterlyOptions}
              aria-label="Quarterly OKR progress chart"
            />
          </div>
          <div className="reportInsightGrid">
            <div>
              <p className="caption">OKRs tracked</p>
              <p>{selectedQuarterData.okrs}</p>
            </div>
            <div>
              <p className="caption">Quarter trend</p>
              <p>{selectedQuarterData.trend}</p>
            </div>
            <div>
              <p className="caption">Top focus</p>
              <p>{selectedQuarterData.focus}</p>
            </div>
          </div>
          <div className="reportLegend">
            <div className="reportLegendItem">
              <span className="reportLegendSwatch reportBarStrong" />
              Strong momentum
            </div>
            <div className="reportLegendItem">
              <span className="reportLegendSwatch reportBarModerate" />
              Steady pace
            </div>
            <div className="reportLegendItem">
              <span className="reportLegendSwatch reportBarRisk" />
              Needs attention
            </div>
          </div>
        </div>

        <div className="card reportChartCard">
          <div className="reportChartHeader">
            <div>
              <h2>Yearly Progress</h2>
              <p className="muted">Five-year OKR completion trend.</p>
            </div>
            <span className="caption">
              Completed OKRs: {yearlyProgress[yearlyProgress.length - 1]?.completed ?? 0}
            </span>
          </div>
          <div className="reportLineWrap">
            <div className="reportChartCanvas reportChartCanvasTall">
              <Line
                data={yearlyChart.data}
                options={yearlyOptions}
                aria-label="Yearly OKR progress chart"
              />
            </div>
            <div className="reportYearLabels">
              {yearlyProgress.map((item) => (
                <div key={item.year} className="caption">
                  {item.year}
                  <span className="reportYearValue">{item.progress}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="reportInsightGrid">
            <div>
              <p className="caption">Average progress</p>
              <p>
                {yearlyProgress.length
                  ? Math.round(
                      yearlyProgress.reduce((sum, item) => sum + item.progress, 0) /
                        yearlyProgress.length
                    )
                  : 0}
                %
              </p>
            </div>
            <div>
              <p className="caption">Highest momentum</p>
              <p>
                {yearlyProgress.length
                  ? yearlyProgress.reduce((best, item) => (item.progress > best.progress ? item : best))
                      .year
                  : selectedYear}
              </p>
            </div>
            <div>
              <p className="caption">Completions</p>
              <p>{yearlyProgress.reduce((total, item) => total + item.completed, 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? <div className="errorBanner">{errorMessage}</div> : null}
      {toastMessage ? <div className="toast toastSuccess">{toastMessage}</div> : null}
      {isLoading ? <LoadingOverlay message="Preparing report" /> : null}
    </section>
  );
}
