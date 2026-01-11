import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Modal } from "@/components/ui/modal";
import { LoadingOverlay } from "@/components/ui/loadingOverlay";
import type { Okr } from "@/features/okr/okrTypes";
import { getOkrs } from "@/services/okrService";
import { logError, logInfo } from "@/utils/logger";

interface HomeViewProps {
  userName: string;
  isFirstTimeUser: boolean;
  onCreateOkr: () => void;
  onFirstTimeSeen?: () => void;
}

interface StatusSummaryItem {
  label: string;
  value: number;
  colorClass: string;
}

type StatusFilter = "all" | "onTrack" | "atRisk" | "offTrack" | "completed";

interface HomeOkrCard {
  id: string;
  title: string;
  status: "On Track" | "At Risk" | "Off Track" | "Completed";
  progress: number;
  keyResults: number;
  updated: string;
  dueDate: string;
}

const statusToneMap: Record<HomeOkrCard["status"], "success" | "warning" | "danger" | "info"> = {
  "On Track": "success",
  "At Risk": "warning",
  "Off Track": "danger",
  Completed: "info"
};

const statusFilterOptions: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "onTrack", label: "On Track" },
  { id: "atRisk", label: "At Risk" },
  { id: "offTrack", label: "Off Track" },
  { id: "completed", label: "Completed" }
];

const formatRelativeTime = (value?: string) => {
  if (!value) {
    return "Recently";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) {
    return "Updated just now";
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `Updated ${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Updated ${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Updated ${diffDays}d ago`;
};

export default function HomeView({
  userName,
  isFirstTimeUser,
  onCreateOkr,
  onFirstTimeSeen
}: HomeViewProps) {
  const [isBestPracticesOpen, setIsBestPracticesOpen] = useState(false);
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusSummary = useMemo<StatusSummaryItem[]>(() => {
    const summary = {
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      completed: 0
    };

    okrs.forEach((okr) => {
      if (okr.progress >= 100) {
        summary.completed += 1;
        return;
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

    return [
      { label: "On Track", value: summary.onTrack, colorClass: "statusOnTrack" },
      { label: "At Risk", value: summary.atRisk, colorClass: "statusAtRisk" },
      { label: "Off Track", value: summary.offTrack, colorClass: "statusOffTrack" },
      { label: "Completed", value: summary.completed, colorClass: "statusComplete" }
    ];
  }, [okrs]);

  const filteredOkrs = useMemo(() => {
    if (statusFilter === "all") {
      return okrs;
    }

    if (statusFilter === "completed") {
      return okrs.filter((okr) => okr.progress >= 100);
    }

    return okrs.filter((okr) => okr.status === statusFilter);
  }, [okrs, statusFilter]);

  const okrCards = useMemo<HomeOkrCard[]>(() => {
    return filteredOkrs.slice(0, 3).map((okr) => ({
      id: okr.id,
      title: okr.objective,
      status: okr.progress >= 100 ? "Completed" : okr.status === "onTrack" ? "On Track" : okr.status === "atRisk" ? "At Risk" : "Off Track",
      progress: okr.progress,
      keyResults: okr.keyResults.length,
      updated: formatRelativeTime(okr.updatedAt ?? okr.createdAt),
      dueDate: okr.dueDate
    }));
  }, [filteredOkrs]);

  const maxStatusValue = Math.max(1, ...statusSummary.map((item) => item.value));

  useEffect(() => {
    let isActive = true;

    const loadOkrs = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await getOkrs();
        if (isActive) {
          setOkrs(data);
        }
      } catch (error) {
        logError("ui", "Failed to load dashboard OKRs", error);
        if (isActive) {
          setErrorMessage("Unable to load dashboard data.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadOkrs();
    const interval = window.setInterval(() => {
      void loadOkrs();
    }, 60000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isFirstTimeUser && okrs.length > 0) {
      onFirstTimeSeen?.();
    }
  }, [isFirstTimeUser, okrs.length, onFirstTimeSeen]);

  const showFirstTime = isFirstTimeUser;

  return (
    <section className="pageSection">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>{isFirstTimeUser ? `Welcome to OKR Tracker, ${userName}!` : `Welcome back, ${userName}!`}</h1>
          <p className="muted">
            {isFirstTimeUser
              ? "Set your first objective and start tracking progress today."
              : "Here is your latest progress pulse across teams."}
          </p>
        </div>
        <div className="pageHeaderActions">
          <Button type="button" onClick={onCreateOkr}>
            {isFirstTimeUser ? "Create Your First OKR" : "Create New OKR"}
          </Button>
        </div>
      </div>

      {showFirstTime ? (
        <div className="firstTimeGrid">
          <div className="card heroCard">
            <h2>Start with a clear objective</h2>
            <p className="muted">
              Break down your next 90 days into outcomes that are specific, measurable, and time-bound.
            </p>
            <div className="heroActions">
              <button
                type="button"
                className="textLink"
                onClick={() => {
                  logInfo("ui", "Opening best practices modal");
                  setIsBestPracticesOpen(true);
                }}
              >
                {`Best Practices for Creating SMART Goals \u{1F4A1}`}
              </button>
            </div>
          </div>
          <div className="card tipCard">
            <h3>Quick start checklist</h3>
            <ul className="checklist">
              <li>Define one ambitious objective</li>
              <li>Attach 3-5 measurable key results</li>
              <li>Assign owners and due dates</li>
              <li>Schedule weekly check-ins</li>
            </ul>
          </div>
          <div className="card tipCard">
            <h3>Sample OKR</h3>
            <p className="muted">Objective: Increase customer retention.</p>
            <p className="caption">Key Results</p>
            <ul className="checklist">
              <li>Reduce churn to 3.5%</li>
              <li>Launch onboarding improvements</li>
              <li>Reach 95% renewal rate</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="habitualGrid">
          <div className="card statusCard">
            <div className="statusHeader">
              <h2>OKR Status Overview</h2>
              <p className="muted">Summary across all active objectives.</p>
            </div>
            <div className="statusChart">
              {statusSummary.map((item) => {
                const heightPercent = (item.value / maxStatusValue) * 100;
                return (
                  <div key={item.label} className="statusColumn">
                    <div className={`statusBar ${item.colorClass}`} style={{ height: `${heightPercent}%` }} />
                    <span className="caption">{item.label}</span>
                    <span className="statusValue">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card okrMiniSection">
            <div className="sectionHeader">
              <div>
                <h2>Your OKRs</h2>
                <p className="muted">Progress snapshots across your portfolio.</p>
              </div>
            </div>
            <div className="filterRow">
              {statusFilterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`filterChip ${statusFilter === option.id ? "filterChipActive" : ""}`}
                  onClick={() => setStatusFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="okrMiniGrid">
              {okrCards.map((okr) => {
                const donutStyle = { ["--value" as const]: okr.progress } as CSSProperties;
                return (
                  <div key={okr.id} className="okrMiniCard">
                    <div className="okrMiniHeader">
                      <h3>{okr.title}</h3>
                      <Chip tone={statusToneMap[okr.status]}>{okr.status}</Chip>
                    </div>
                    <div className="okrMiniBody">
                      <div className="okrDonut" style={donutStyle}>
                        <span>{okr.progress}%</span>
                      </div>
                      <div className="okrMiniMeta">
                        <p className="caption">Key Results</p>
                        <p>{okr.keyResults}</p>
                        <p className="caption">Last Updated</p>
                        <p>{okr.updated}</p>
                        <p className="caption">Due Date</p>
                        <p>{okr.dueDate}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {errorMessage ? <div className="errorBanner">{errorMessage}</div> : null}
            {!okrCards.length && !isLoading && !errorMessage ? (
              <p className="caption">No OKRs match this filter yet.</p>
            ) : null}
          </div>
        </div>
      )}

      <Modal
        isOpen={isBestPracticesOpen}
        title="SMART Goal Best Practices"
        description="Use these tips to craft measurable objectives."
        onClose={() => setIsBestPracticesOpen(false)}
        actions={
          <Button type="button" onClick={() => setIsBestPracticesOpen(false)}>
            Got it
          </Button>
        }
      >
        <ul className="checklist">
          <li>Be specific about the outcome you want.</li>
          <li>Pick 3-5 measurable key results.</li>
          <li>Set a clear timeframe for completion.</li>
          <li>Align each OKR with team priorities.</li>
        </ul>
      </Modal>
      {isLoading ? <LoadingOverlay message="Refreshing dashboard" /> : null}
    </section>
  );
}
