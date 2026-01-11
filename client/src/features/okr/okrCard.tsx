import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ProgressBar } from "@/components/ui/progressBar";
import { Okr } from "@/features/okr/okrTypes";

interface OkrCardProps {
  okr: Okr;
  onEdit?: (okr: Okr) => void;
  onCopy?: (okr: Okr) => void;
  onDelete?: (okr: Okr) => void;
}

const statusToneMap: Record<Okr["status"], "success" | "warning" | "danger"> = {
  onTrack: "success",
  atRisk: "warning",
  offTrack: "danger"
};

const statusLabelMap: Record<Okr["status"], string> = {
  onTrack: "On Track",
  atRisk: "At Risk",
  offTrack: "Off Track"
};

export function OkrCard({ okr, onEdit, onCopy, onDelete }: OkrCardProps) {
  const ownersLabel = okr.owners.length ? okr.owners.join(", ") : okr.owner ?? "Unassigned";

  return (
    <Card className="okrCard" data-testid="okr-card">
      <div className="okrHeader">
        <div>
          <p className="caption">Objective</p>
          <h3>{okr.objective}</h3>
        </div>
        <div className="okrHeaderActions">
          <Chip tone={statusToneMap[okr.status]}>{statusLabelMap[okr.status]}</Chip>
          <div className="okrActionGroup">
            <button type="button" className="iconButton" onClick={() => onCopy?.(okr)} aria-label="Copy OKR">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M7 7h9c1.1 0 2 .9 2 2v9h-2V9H7V7zm-2 4h9c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-9c0-1.1.9-2 2-2zm0 2v9h9v-9H5z"
                />
              </svg>
            </button>
            <button type="button" className="iconButton" onClick={() => onEdit?.(okr)} aria-label="Edit OKR">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M4 17.3V20h2.7l8-8-2.7-2.7-8 8zm15.7-9.3c.4-.4.4-1 0-1.4l-2-2c-.4-.4-1-.4-1.4 0l-1.6 1.6 3.4 3.4 1.6-1.6z"
                />
              </svg>
            </button>
            <button type="button" className="iconButton destructiveIcon" onClick={() => onDelete?.(okr)} aria-label="Delete OKR">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M6 7h12v2H6V7zm2 3h2v8H8v-8zm6 0h2v8h-2v-8zM9 4h6l1 1h4v2H4V5h4l1-1z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="okrMeta">
        <div>
          <p className="caption">Owner</p>
          <p>{ownersLabel}</p>
        </div>
        <div>
          <p className="caption">Due Date</p>
          <p>{okr.dueDate}</p>
        </div>
        {okr.category ? (
          <div>
            <p className="caption">Category</p>
            <p>{okr.category}</p>
          </div>
        ) : null}
        {okr.vertical ? (
          <div>
            <p className="caption">Vertical</p>
            <p>{okr.vertical}</p>
          </div>
        ) : null}
      </div>
      <div className="okrProgress">
        <div className="okrProgressHeader">
          <p className="caption">Progress</p>
          <p className="progressValue">{okr.progress}%</p>
        </div>
        <ProgressBar value={okr.progress} />
      </div>
      <div className="okrKeyResults">
        <p className="caption">Key Results</p>
        <ul>
          {okr.keyResults.map((result) => (
            <li key={result.id}>
              <span>{result.title}</span>
              <span className="muted">
                {result.current} / {result.target}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
