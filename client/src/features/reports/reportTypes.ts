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

export interface QuarterlyReportResponse {
  year: number;
  quarters: QuarterlyProgress[];
  summary: ReportSummary;
}

export interface YearlyReportResponse {
  years: YearlyProgress[];
  insights: {
    averageProgress: number;
    highestMomentumYear: number;
    totalCompleted: number;
  };
}
