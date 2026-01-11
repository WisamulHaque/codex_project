import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progressBar";
import { OkrSummary } from "@/features/okr/okrTypes";

interface OkrSummaryProps {
  summary: OkrSummary;
}

export function OkrSummaryCard({ summary }: OkrSummaryProps) {
  return (
    <Card className="summaryCard" data-testid="okr-summary">
      <div>
        <p className="caption">Overall Progress</p>
        <h2>{summary.overallProgress}%</h2>
      </div>
      <ProgressBar value={summary.overallProgress} />
      <div className="summaryStats">
        <div>
          <p className="caption">Objectives</p>
          <p>{summary.totalObjectives}</p>
        </div>
        <div>
          <p className="caption">On Track</p>
          <p>{summary.onTrack}</p>
        </div>
        <div>
          <p className="caption">At Risk</p>
          <p>{summary.atRisk}</p>
        </div>
        <div>
          <p className="caption">Off Track</p>
          <p>{summary.offTrack}</p>
        </div>
      </div>
    </Card>
  );
}
