import { Request, Response } from "express";
import {
  cloneOkr,
  createOkr,
  deleteOkr,
  getOkrById,
  listOkrs,
  updateKeyResultStatus,
  updateOkr,
  updateOkrOwners
} from "../services/okrService";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";

export async function getOkrs(request: Request, response: Response) {
  logInfo("route", "GET /okrs");
  const { search, status, owner, category, vertical } = request.query;
  const page = Math.max(1, Number(request.query.page ?? 1) || 1);
  const limit = Math.max(1, Number(request.query.limit ?? 20) || 20);
  const result = await listOkrs({
    search: typeof search === "string" ? search : undefined,
    status: typeof status === "string" ? status : undefined,
    owner: typeof owner === "string" ? owner : undefined,
    category: typeof category === "string" ? category : undefined,
    vertical: typeof vertical === "string" ? vertical : undefined,
    page,
    limit
  });
  return response.status(200).json({ data: result.okrs, pagination: result.pagination });
}

export async function postOkr(request: Request, response: Response) {
  logInfo("route", "POST /okrs");
  if (!request.user?.userId) {
    throw new AppError("Unauthorized.", 401);
  }
  const { objective, dueDate, owners, category, vertical } = request.body ?? {};
  if (!objective || !dueDate) {
    throw new AppError("Objective and due date are required.", 400);
  }
  if (!category || !vertical) {
    throw new AppError("Category and department are required.", 400);
  }
  if (owners && Array.isArray(owners) && owners.length === 0) {
    throw new AppError("At least one owner is required.", 400);
  }
  const okr = await createOkr({ ...request.body, createdBy: request.user.userId });
  return response.status(201).json({ data: okr });
}

export async function getOkr(request: Request, response: Response) {
  logInfo("route", "GET /okrs/:id");
  const okr = await getOkrById(request.params.id);
  return response.status(200).json({ data: okr });
}

export async function patchOkr(request: Request, response: Response) {
  logInfo("route", "PATCH /okrs/:id");
  if (Array.isArray(request.body?.owners) && request.body.owners.length === 0) {
    throw new AppError("At least one owner is required.", 400);
  }
  const okr = await updateOkr(request.params.id, request.body ?? {}, request.user);
  return response.status(200).json({ data: okr, message: "OKR updated successfully." });
}

export async function deleteOkrHandler(request: Request, response: Response) {
  logInfo("route", "DELETE /okrs/:id");
  await deleteOkr(request.params.id, request.user);
  return response.status(200).json({ message: "OKR deleted successfully!" });
}

export async function cloneOkrHandler(request: Request, response: Response) {
  logInfo("route", "POST /okrs/:id/clone");
  const okr = await cloneOkr(request.params.id, { ...request.body, createdBy: request.user?.userId });
  return response.status(201).json({ data: okr, message: "New OKR created from the copied objective!" });
}

export async function updateKeyResultStatusHandler(request: Request, response: Response) {
  logInfo("route", "PATCH /okrs/:id/key-results/:krId/status");
  const { status } = request.body ?? {};
  if (!status) {
    throw new AppError("Status is required.", 400);
  }
  const allowedStatuses = ["onTrack", "atRisk", "offTrack", "completed"];
  if (!allowedStatuses.includes(status)) {
    throw new AppError("Invalid status value.", 400);
  }
  const okr = await updateKeyResultStatus(request.params.id, request.params.krId, status, request.user);
  return response.status(200).json({ data: okr, message: "Key result status updated." });
}

export async function updateOkrOwnersHandler(request: Request, response: Response) {
  logInfo("route", "PATCH /okrs/:id/owners");
  const { owners } = request.body ?? {};
  if (!Array.isArray(owners)) {
    throw new AppError("Owners are required.", 400);
  }
  const okr = await updateOkrOwners(request.params.id, owners, request.user);
  return response.status(200).json({ data: okr, message: "OKR assigned successfully." });
}
