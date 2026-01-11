import { UserModel } from "../models/userModel";
import { AppError } from "../utils/appError";
import { hashPassword, verifyPassword } from "../utils/passwordUtils";
import { ensureStrongPassword } from "../utils/passwordPolicy";
import { logInfo } from "../utils/logger";

interface ProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  designation?: string;
  department?: string;
}

export async function getUserById(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
}

export async function updateUserProfile(userId: string, updates: ProfileUpdateInput) {
  const user = await getUserById(userId);

  const updateEntries: Array<[keyof ProfileUpdateInput, string | undefined]> = [
    ["firstName", updates.firstName],
    ["lastName", updates.lastName],
    ["designation", updates.designation],
    ["department", updates.department]
  ];

  updateEntries.forEach(([field, value]) => {
    if (value !== undefined) {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new AppError(`${field} is required.`, 400);
      }
      user.set(field, trimmed);
    }
  });

  await user.save();
  logInfo("service", `Profile updated for ${user.email}`);
  return user;
}

export async function updateUserPassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await getUserById(userId);

  if (!user.passwordHash) {
    throw new AppError("Password login is not configured for this account.", 400);
  }

  const isValid = await verifyPassword(oldPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError("Old password is incorrect.", 401);
  }

  ensureStrongPassword(newPassword);
  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  logInfo("service", `Password updated for ${user.email}`);
  return user;
}

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  const user = await getUserById(userId);
  const trimmed = avatarUrl.trim();
  if (!trimmed) {
    user.avatarUrl = undefined;
  } else {
    user.avatarUrl = trimmed;
  }
  await user.save();
  logInfo("service", `Avatar updated for ${user.email}`);
  return user;
}
