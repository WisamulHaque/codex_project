import type { Request, Response } from "express";
import { AppError } from "../utils/appError";
import {
  bulkCreateUsers,
  bulkDeleteUsers,
  bulkUpdateUserRoles,
  createUser,
  deleteUser,
  listUsers,
  normalizeRoleInput,
  updateUser,
  updateUserRole
} from "../services/userManagementService";
import type { UserDocument } from "../models/userModel";
import { logInfo } from "../utils/logger";

function toUserSummary(user: UserDocument, okrsAssigned = 0) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    department: user.department,
    designation: user.designation,
    manager: user.manager,
    okrsAssigned,
    createdAt: user.createdAt
  };
}

export async function listUsersHandler(request: Request, response: Response) {
  const page = Math.max(1, Number(request.query.page ?? 1) || 1);
  const limit = Math.max(1, Number(request.query.limit ?? 10) || 10);
  const search = typeof request.query.search === "string" ? request.query.search : undefined;
  const roleInput = typeof request.query.role === "string" ? request.query.role : undefined;
  const role = roleInput && roleInput !== "all" ? normalizeRoleInput(roleInput) : undefined;

  logInfo("route", "GET /users");
  const result = await listUsers({ page, limit, search, role });
  return response.status(200).json({
    data: result.users.map((user) => toUserSummary(user, result.assignedCounts.get(user._id.toString()) ?? 0)),
    pagination: result.pagination
  });
}

export async function createUserHandler(request: Request, response: Response) {
  const { fullName, email, role, department, designation, manager } = request.body ?? {};
  if (!fullName || !email) {
    throw new AppError("Full name and email are required.", 400);
  }

  const { user } = await createUser({
    fullName,
    email,
    role: normalizeRoleInput(role),
    department,
    designation,
    manager
  });

  return response.status(201).json({
    data: toUserSummary(user),
    message: "User created successfully."
  });
}

export async function bulkCreateUsersHandler(request: Request, response: Response) {
  const { users } = request.body ?? {};
  if (!Array.isArray(users) || users.length === 0) {
    throw new AppError("Users payload is required.", 400);
  }

  const created = await bulkCreateUsers(users);
  return response.status(201).json({
    data: created.map((entry) => ({
      user: toUserSummary(entry.user)
    })),
    message: `Created ${created.length} users.`
  });
}

export async function updateUserHandler(request: Request, response: Response) {
  const { id } = request.params;
  const { fullName, email, department, designation, manager } = request.body ?? {};
  const user = await updateUser(id, { fullName, email, department, designation, manager });
  return response.status(200).json({ data: toUserSummary(user), message: "User updated successfully." });
}

export async function updateUserRoleHandler(request: Request, response: Response) {
  const { id } = request.params;
  const { role } = request.body ?? {};
  if (!role) {
    throw new AppError("Role is required.", 400);
  }

  const user = await updateUserRole(id, role);
  return response.status(200).json({ data: toUserSummary(user), message: "Role updated successfully." });
}

export async function bulkUpdateRolesHandler(request: Request, response: Response) {
  const { userIds, role } = request.body ?? {};
  if (!Array.isArray(userIds) || userIds.length === 0 || !role) {
    throw new AppError("User IDs and role are required.", 400);
  }

  const updatedCount = await bulkUpdateUserRoles(userIds, role);
  return response.status(200).json({
    message: `Updated role for ${updatedCount} users.`
  });
}

export async function deleteUserHandler(request: Request, response: Response) {
  const { id } = request.params;
  await deleteUser(id, request.user);
  return response.status(200).json({ message: "User deleted successfully." });
}

export async function bulkDeleteUsersHandler(request: Request, response: Response) {
  const { userIds } = request.body ?? {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError("User IDs are required.", 400);
  }

  const deletedCount = await bulkDeleteUsers(userIds, request.user);
  return response.status(200).json({ message: `Deleted ${deletedCount} users.` });
}
