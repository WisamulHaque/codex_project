export type OkrStatus = "onTrack" | "atRisk" | "offTrack";
export type KeyResultStatus = "onTrack" | "atRisk" | "offTrack" | "completed";

export type MeasurementScale = "percentage" | "numeric";

export interface KeyResult {
  id: string;
  title: string;
  measurementScale: MeasurementScale;
  current: number;
  target: number;
  owner: string;
  dueDate: string;
  status?: KeyResultStatus;
}

export interface Okr {
  id: string;
  objective: string;
  description?: string;
  owners: string[];
  owner?: string;
  createdBy?: string;
  dueDate: string;
  category?: string;
  vertical?: string;
  status: OkrStatus;
  progress: number;
  createdAt?: string;
  updatedAt?: string;
  keyResults: KeyResult[];
}

export interface OkrSummary {
  totalObjectives: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
  overallProgress: number;
}

export interface OkrDto {
  id: string;
  objective: string;
  description?: string;
  owner: string;
  owners?: string[];
  createdBy?: string;
  dueDate: string;
  category?: string;
  vertical?: string;
  status: OkrStatus;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
  keyResults: Array<{
    id: string;
    title: string;
    measurementScale?: MeasurementScale;
    current: number;
    target: number;
    owner?: string;
    dueDate?: string;
    status?: KeyResultStatus;
  }>;
}
