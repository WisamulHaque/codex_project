import crypto from "crypto";
import mongoose from "mongoose";
import { OkrModel } from "../models/okrModel";
import { UserModel } from "../models/userModel";
import type { OkrInput, KeyResultStatus } from "../types/okrTypes";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";
import { createOwnerChangeNotifications, createProgressNotifications } from "./notificationService";
import { sendSlackMessage } from "./slackService";
import type { TokenPayload } from "../utils/tokenFactory";

interface OkrQueryParams {
  search?: string;
  status?: string;
  owner?: string;
  category?: string;
  vertical?: string;
  page?: number;
  limit?: number;
}

function calculateProgress(keyResults: OkrInput["keyResults"]) {
  if (!keyResults || keyResults.length === 0) {
    return 0;
  }

  const statusScores: Record<KeyResultStatus, number> = {
    completed: 100,
    onTrack: 75,
    atRisk: 45,
    offTrack: 20
  };

  const progressValues = keyResults.map((keyResult) => {
    const target = keyResult?.target ?? 0;
    const current = keyResult?.current ?? 0;
    if (target > 0) {
      return Math.min(100, Math.round((current / target) * 100));
    }
    if (keyResult?.status) {
      return statusScores[keyResult.status] ?? 0;
    }
    return 0;
  });

  return Math.round(progressValues.reduce((total, value) => total + value, 0) / progressValues.length);
}

function deriveOkrStatus(keyResults: OkrInput["keyResults"]): "onTrack" | "atRisk" | "offTrack" {
  if (!keyResults || keyResults.length === 0) {
    return "onTrack";
  }

  let hasAtRisk = false;
  for (const keyResult of keyResults) {
    const status = keyResult?.status;
    if (status === "offTrack") {
      return "offTrack";
    }
    if (status === "atRisk") {
      hasAtRisk = true;
      continue;
    }
    if (!status && keyResult?.target) {
      const ratio = (keyResult.current ?? 0) / keyResult.target;
      if (ratio < 0.4) {
        return "offTrack";
      }
      if (ratio < 0.7) {
        hasAtRisk = true;
      }
    }
  }

  return hasAtRisk ? "atRisk" : "onTrack";
}

function mapKeyResults(keyResults: OkrInput["keyResults"]) {
  return (keyResults ?? []).map((keyResult) => {
    const mapped = {
      title: keyResult.title,
      measurementScale: keyResult.measurementScale ?? "percentage",
      current: keyResult.current ?? 0,
      target: keyResult.target ?? 0,
      owner: keyResult.owner,
      dueDate: keyResult.dueDate,
      status: keyResult.status ?? "onTrack"
    };

    if (keyResult.id && mongoose.Types.ObjectId.isValid(keyResult.id)) {
      return { _id: keyResult.id, ...mapped };
    }

    return mapped;
  });
}

function mapOkr(okr: Awaited<ReturnType<typeof OkrModel.findById>> & { _id?: unknown }) {
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }
  return {
    id: okr._id.toString(),
    objective: okr.objective,
    description: okr.description,
    owners: okr.owners?.length ? okr.owners : okr.owner ? [okr.owner] : [],
    owner: okr.owner,
    createdBy: okr.createdBy,
    dueDate: okr.dueDate,
    category: okr.category,
    vertical: okr.vertical,
    status: okr.status,
    progress: okr.progress ?? 0,
    createdAt: okr.createdAt?.toISOString?.() ?? undefined,
    updatedAt: okr.updatedAt?.toISOString?.() ?? undefined,
    keyResults: okr.keyResults.map((keyResult) => ({
      id: keyResult._id?.toString() ?? crypto.randomUUID(),
      title: keyResult.title,
      measurementScale: keyResult.measurementScale,
      current: keyResult.current,
      target: keyResult.target,
      owner: keyResult.owner,
      dueDate: keyResult.dueDate,
      status: keyResult.status
    }))
  };
}

function normalizeOwner(value?: string) {
  return value?.trim().toLowerCase();
}

async function resolveOwnerAccess(okr: Awaited<ReturnType<typeof OkrModel.findById>>, actor?: TokenPayload) {
  if (!actor) {
    throw new AppError("Unauthorized.", 401);
  }
  const user = await UserModel.findById(actor.userId);
  if (!user) {
    throw new AppError("Unauthorized.", 401);
  }

  const identifiers = new Set(
    [user.email, `${user.firstName} ${user.lastName}`.trim()]
      .map((value) => normalizeOwner(value))
      .filter((value): value is string => Boolean(value))
  );
  const ownerValues = [okr?.owner, ...(okr?.owners ?? [])]
    .map((value) => normalizeOwner(value))
    .filter((value): value is string => Boolean(value));

  const ownerMatch = ownerValues.some((value) => identifiers.has(value));
  const creatorMatch = Boolean(okr?.createdBy && okr.createdBy === actor.userId);
  return { ownerMatch, creatorMatch };
}

async function ensureOwnerOrCreator(okr: Awaited<ReturnType<typeof OkrModel.findById>>, actor?: TokenPayload) {
  const access = await resolveOwnerAccess(okr, actor);
  if (!access.ownerMatch && !access.creatorMatch) {
    throw new AppError("You do not have permission to update this OKR.", 403);
  }
}

async function ensureDeleteAccess(okr: Awaited<ReturnType<typeof OkrModel.findById>>, actor?: TokenPayload) {
  if (!actor) {
    throw new AppError("Unauthorized.", 401);
  }
  const access = await resolveOwnerAccess(okr, actor);
  if (access.creatorMatch || access.ownerMatch) {
    return;
  }
  throw new AppError("You do not have permission to delete this OKR.", 403);
}

// Service layer keeps domain logic separate from transport.
export async function listOkrs(params: OkrQueryParams = {}) {
  logInfo("service", "Listing OKRs");
  const query: Record<string, unknown> = {};
  const andConditions: Array<Record<string, unknown>> = [];

  if (params.status) {
    query.status = params.status;
  }
  if (params.owner) {
    andConditions.push({ $or: [{ owner: params.owner }, { owners: params.owner }] });
  }
  if (params.category) {
    query.category = params.category;
  }
  if (params.vertical) {
    query.vertical = params.vertical;
  }
  if (params.search) {
    const regex = new RegExp(params.search, "i");
    andConditions.push({
      $or: [
        { objective: regex },
        { description: regex },
        { owner: regex },
        { owners: regex },
        { category: regex },
        { vertical: regex },
        { "keyResults.title": regex }
      ]
    });
  }

  if (andConditions.length) {
    query.$and = andConditions;
  }

  const totalItems = await OkrModel.countDocuments(query);
  const limit = params.limit ?? Math.max(1, totalItems);
  const page = Math.max(1, params.page ?? 1);
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  let queryBuilder = OkrModel.find(query).sort({ createdAt: -1 });
  if (params.limit) {
    queryBuilder = queryBuilder.skip((page - 1) * limit).limit(limit);
  }

  const okrs = await queryBuilder;
  return {
    okrs: okrs.map((okr) => mapOkr(okr)),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages
    }
  };
}

export async function createOkr(input: OkrInput) {
  logInfo("service", "Creating OKR");
  const owners = input.owners?.length ? input.owners : input.owner ? [input.owner] : [];
  const progress = input.progress ?? calculateProgress(input.keyResults);
  const keyResults = mapKeyResults(input.keyResults);

  const okr = await OkrModel.create({
    objective: input.objective,
    description: input.description,
    owners,
    owner: input.owner,
    createdBy: input.createdBy,
    dueDate: input.dueDate,
    category: input.category,
    vertical: input.vertical,
    status: input.status ?? "onTrack",
    progress,
    keyResults
  });

  if (owners.length) {
    await createOwnerChangeNotifications({
      okrId: okr._id.toString(),
      okrObjective: okr.objective,
      addedOwners: owners,
      removedOwners: []
    });
  }

  const ownerLabel = owners.length ? owners.join(", ") : "Unassigned";
  const categoryLabel = okr.category ?? "Unspecified";
  const departmentLabel = okr.vertical ?? "Unspecified";
  const slackText = `New OKR created: "${okr.objective}"\nOwners: ${ownerLabel}\nDue: ${okr.dueDate}\nCategory: ${categoryLabel}\nDepartment: ${departmentLabel}`;
  void sendSlackMessage({ text: slackText });

  return mapOkr(okr);
}

export async function getOkrById(id: string) {
  const okr = await OkrModel.findById(id);
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }
  return mapOkr(okr);
}

export async function updateOkr(id: string, input: Partial<OkrInput>, actor?: TokenPayload) {
  const okr = await OkrModel.findById(id);
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }

  await ensureOwnerOrCreator(okr, actor);

  const previousOwners = okr.owners?.length ? okr.owners : okr.owner ? [okr.owner] : [];
  const previousStatus = okr.status;
  const previousProgress = okr.progress ?? 0;

  if (input.objective !== undefined) {
    okr.objective = input.objective;
  }
  if (input.description !== undefined) {
    okr.description = input.description;
  }
  if (input.owners !== undefined) {
    okr.owners = input.owners;
    okr.owner = input.owners[0];
  }
  if (input.owner !== undefined) {
    okr.owner = input.owner;
  }
  if (input.dueDate !== undefined) {
    okr.dueDate = input.dueDate;
  }
  if (input.category !== undefined) {
    okr.category = input.category;
  }
  if (input.vertical !== undefined) {
    okr.vertical = input.vertical;
  }
  if (input.status !== undefined) {
    okr.status = input.status;
  }
  if (input.keyResults !== undefined) {
    okr.keyResults = mapKeyResults(input.keyResults);
    okr.progress = calculateProgress(input.keyResults);
  }
  if (input.progress !== undefined) {
    okr.progress = input.progress;
  }

  await okr.save();

  const nextOwners = okr.owners?.length ? okr.owners : okr.owner ? [okr.owner] : [];
  const addedOwners = nextOwners.filter((owner) => !previousOwners.includes(owner));
  const removedOwners = previousOwners.filter((owner) => !nextOwners.includes(owner));

  if (addedOwners.length || removedOwners.length) {
    await createOwnerChangeNotifications({
      okrId: okr._id.toString(),
      okrObjective: okr.objective,
      addedOwners,
      removedOwners
    });
  }

  const progressChanged = okr.progress !== previousProgress;
  const statusChanged = okr.status !== previousStatus;
  if (progressChanged || statusChanged) {
    await createProgressNotifications({
      okrId: okr._id.toString(),
      okrObjective: okr.objective,
      owners: nextOwners,
      message: `Progress updated to ${okr.progress}% for "${okr.objective}".`,
      contextLabel: "OKR",
      contextId: okr._id.toString()
    });
  }

  return mapOkr(okr);
}

export async function deleteOkr(id: string, actor?: TokenPayload) {
  const okr = await OkrModel.findById(id);
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }
  await ensureDeleteAccess(okr, actor);
  await okr.deleteOne();
  return true;
}

export async function cloneOkr(id: string, overrides: Partial<OkrInput> = {}) {
  const okr = await OkrModel.findById(id);
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }

  const owners = overrides.owners?.length ? overrides.owners : okr.owners;
  const keyResults = overrides.keyResults ? mapKeyResults(overrides.keyResults) : okr.keyResults;
  const progress = overrides.progress ?? calculateProgress(overrides.keyResults ?? okr.keyResults);

  const cloned = await OkrModel.create({
    objective: overrides.objective ?? `${okr.objective} (Copy)`,
    description: overrides.description ?? okr.description,
    owners,
    owner: owners?.[0] ?? okr.owner,
    createdBy: overrides.createdBy ?? okr.createdBy,
    dueDate: overrides.dueDate ?? okr.dueDate,
    category: overrides.category ?? okr.category,
    vertical: overrides.vertical ?? okr.vertical,
    status: overrides.status ?? okr.status,
    progress,
    keyResults
  });

  return mapOkr(cloned);
}

export async function updateKeyResultStatus(
  okrId: string,
  keyResultId: string,
  status: KeyResultStatus,
  actor?: TokenPayload
) {
  const okr = await OkrModel.findById(okrId);
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }
  await ensureOwnerOrCreator(okr, actor);

  const keyResult = okr.keyResults.id(keyResultId);
  if (!keyResult) {
    throw new AppError("Key result not found.", 404);
  }

  const previousStatus = keyResult.status;
  keyResult.status = status;
  if (keyResult.target && keyResult.target > 0 && status === "completed") {
    keyResult.current = keyResult.target;
  }
  okr.progress = calculateProgress(okr.keyResults);
  okr.status = deriveOkrStatus(okr.keyResults);
  await okr.save();

  if (previousStatus !== status) {
    const owners = okr.owners?.length ? okr.owners : okr.owner ? [okr.owner] : [];
    await createProgressNotifications({
      okrId: okr._id.toString(),
      okrObjective: okr.objective,
      owners,
      message: `Key result "${keyResult.title}" is now ${status}.`,
      contextLabel: "key result",
      contextId: keyResultId
    });
  }

  return mapOkr(okr);
}

export async function updateOkrOwners(okrId: string, owners: string[], actor?: TokenPayload) {
  if (!owners.length) {
    throw new AppError("Owners are required.", 400);
  }

  const okr = await OkrModel.findById(okrId);
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }
  await ensureOwnerOrCreator(okr, actor);

  const previousOwners = okr.owners?.length ? okr.owners : okr.owner ? [okr.owner] : [];
  okr.owners = owners;
  okr.owner = owners[0];
  await okr.save();

  const addedOwners = owners.filter((owner) => !previousOwners.includes(owner));
  const removedOwners = previousOwners.filter((owner) => !owners.includes(owner));
  if (addedOwners.length || removedOwners.length) {
    await createOwnerChangeNotifications({
      okrId: okr._id.toString(),
      okrObjective: okr.objective,
      addedOwners,
      removedOwners
    });
  }

  return mapOkr(okr);
}
