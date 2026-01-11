import type { Request, Response } from "express";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";
import { getUserById, updateUserAvatar, updateUserPassword, updateUserProfile } from "../services/userService";
import type { UserDocument } from "../models/userModel";

function toSafeUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    department: user.department,
    designation: user.designation,
    manager: user.manager,
    avatarUrl: user.avatarUrl,
    notificationPreferences: user.notificationPreferences ?? {
      emailNotifications: true,
      pushNotifications: true
    },
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function getUserId(request: Request) {
  const userId = request.user?.userId;
  if (!userId) {
    throw new AppError("Unauthorized.", 401);
  }
  return userId;
}

export async function getCurrentUser(request: Request, response: Response) {
  const userId = getUserId(request);
  const user = await getUserById(userId);
  return response.status(200).json({ data: toSafeUser(user) });
}

export async function updateCurrentUser(request: Request, response: Response) {
  const userId = getUserId(request);
  const { firstName, lastName, designation, department } = request.body ?? {};
  logInfo("route", "PATCH /users/me");
  const user = await updateUserProfile(userId, { firstName, lastName, designation, department });
  return response.status(200).json({ data: toSafeUser(user), message: "Profile updated successfully." });
}

export async function updateCurrentPassword(request: Request, response: Response) {
  const userId = getUserId(request);
  const { oldPassword, newPassword } = request.body ?? {};
  if (!oldPassword || !newPassword) {
    throw new AppError("Old password and new password are required.", 400);
  }

  logInfo("route", "PATCH /users/me/password");
  await updateUserPassword(userId, oldPassword, newPassword);
  return response.status(200).json({ message: "Password updated successfully." });
}

export async function updateCurrentAvatar(request: Request, response: Response) {
  const userId = getUserId(request);
  const { avatarUrl, dataUrl } = request.body ?? {};
  const resolvedAvatar = avatarUrl ?? dataUrl;
  if (resolvedAvatar === undefined || resolvedAvatar === null) {
    throw new AppError("Avatar URL is required.", 400);
  }

  logInfo("route", "POST /users/me/avatar");
  const user = await updateUserAvatar(userId, resolvedAvatar);
  return response.status(200).json({ data: toSafeUser(user), message: "Avatar updated successfully." });
}
