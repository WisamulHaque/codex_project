import { Okr, OkrDto } from "@/features/okr/okrTypes";
import { logInfo } from "@/utils/logger";

function calculateProgress(keyResults: OkrDto["keyResults"]) {
  if (keyResults.length === 0) {
    return 0;
  }

  const statusScores: Record<string, number> = {
    completed: 100,
    onTrack: 75,
    atRisk: 45,
    offTrack: 20
  };

  const total = keyResults.reduce((sum, result) => {
    if (result.target > 0) {
      const ratio = Math.min(result.current / result.target, 1);
      return sum + Math.round(ratio * 100);
    }
    if (result.status) {
      return sum + (statusScores[result.status] ?? 0);
    }
    return sum;
  }, 0);

  return Math.round(total / keyResults.length);
}

// Adapter pattern: map API payloads into UI-friendly models.
export function mapOkrDtoToOkr(dto: OkrDto): Okr {
  logInfo("adapter", `Mapping OKR ${dto.id}`);

  return {
    ...dto,
    owners: dto.owners?.length ? dto.owners : [dto.owner],
    createdBy: dto.createdBy,
    keyResults: dto.keyResults.map((result) => ({
      id: result.id,
      title: result.title,
      measurementScale: result.measurementScale ?? "numeric",
      current: result.current,
      target: result.target,
      owner: result.owner ?? dto.owner,
      dueDate: result.dueDate ?? dto.dueDate,
      status: result.status ?? "onTrack"
    })),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    progress: dto.progress ?? calculateProgress(dto.keyResults)
  };
}
