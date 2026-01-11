export type OkrStatus = "onTrack" | "atRisk" | "offTrack";
export type KeyResultStatus = "onTrack" | "atRisk" | "offTrack" | "completed";
export type MeasurementScale = "percentage" | "numeric";

export interface KeyResultInput {
  id?: string;
  title: string;
  measurementScale?: MeasurementScale;
  current?: number;
  target?: number;
  owner?: string;
  dueDate?: string;
  status?: KeyResultStatus;
}

export interface OkrInput {
  objective: string;
  description?: string;
  owners?: string[];
  owner?: string;
  createdBy?: string;
  dueDate: string;
  category?: string;
  vertical?: string;
  status?: OkrStatus;
  progress?: number;
  keyResults?: KeyResultInput[];
}
