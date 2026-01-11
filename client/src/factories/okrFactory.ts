import { Okr, OkrSummary } from "@/features/okr/okrTypes";

// Factory pattern for deriving dashboard summary metrics.
export function createOkrSummary(okrs: Okr[]): OkrSummary {
  const totalObjectives = okrs.length;
  const onTrack = okrs.filter((okr) => okr.status === "onTrack").length;
  const atRisk = okrs.filter((okr) => okr.status === "atRisk").length;
  const offTrack = okrs.filter((okr) => okr.status === "offTrack").length;
  const overallProgress = totalObjectives
    ? Math.round(okrs.reduce((sum, okr) => sum + okr.progress, 0) / totalObjectives)
    : 0;

  return {
    totalObjectives,
    onTrack,
    atRisk,
    offTrack,
    overallProgress
  };
}
