import crypto from "crypto";
import { UserModel } from "../models/userModel";
import { OkrModel } from "../models/okrModel";
import { AppError } from "../utils/appError";
import { ensureStrongPassword } from "../utils/passwordPolicy";
import { hashPassword } from "../utils/passwordUtils";
import { logInfo } from "../utils/logger";
import type { TokenPayload } from "../utils/tokenFactory";

const roleValues = ["admin", "manager", "employee"] as const;
type RoleValue = (typeof roleValues)[number];

interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  role?: RoleValue;
}

interface CreateUserInput {
  fullName: string;
  email: string;
  role?: RoleValue;
  department?: string;
  designation?: string;
  manager?: string;
  password?: string;
}

interface UpdateUserInput {
  fullName?: string;
  email?: string;
  department?: string;
  designation?: string;
  manager?: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOwner(value?: string) {
  return value?.trim().toLowerCase();
}

function normalizeRole(role?: string): RoleValue {
  const normalized = role?.toLowerCase();
  if (normalized && roleValues.includes(normalized as RoleValue)) {
    return normalized as RoleValue;
  }
  return "employee";
}

function parseName(fullName: string) {
  const parts = fullName.trim().split(" ");
  const firstName = parts.shift() || "User";
  const lastName = parts.join(" ") || "User";
  return { firstName, lastName };
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getExpiry(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function generateTempPassword() {
  return `Temp#${crypto.randomBytes(6).toString("hex")}`;
}

export async function listUsers(params: ListUsersParams) {
  const search = params.search?.trim();
  const query: Record<string, unknown> = {};

  if (params.role) {
    query.role = params.role;
  }

  if (search) {
    const regex = new RegExp(search, "i");
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { department: regex },
      { designation: regex },
      { manager: regex }
    ];
  }

  const totalItems = await UserModel.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(totalItems / params.limit));
  const users = await UserModel.find(query)
    .sort({ createdAt: -1 })
    .skip((params.page - 1) * params.limit)
    .limit(params.limit);

  const okrs = await OkrModel.find({}, { owner: 1, owners: 1 });
  const ownerMap = new Map<string, Set<string>>();
  okrs.forEach((okr) => {
    const labels = new Set(
      [okr.owner, ...(okr.owners ?? [])]
        .map((label) => normalizeOwner(label))
        .filter((label): label is string => Boolean(label))
    );
    labels.forEach((label) => {
      if (!ownerMap.has(label)) {
        ownerMap.set(label, new Set());
      }
      ownerMap.get(label)?.add(okr._id.toString());
    });
  });

  const assignedCounts = new Map<string, number>();
  users.forEach((user) => {
    const labels = [user.email, `${user.firstName} ${user.lastName}`.trim()]
      .map((label) => normalizeOwner(label))
      .filter((label): label is string => Boolean(label));
    const okrIds = new Set<string>();
    labels.forEach((label) => {
      const ids = ownerMap.get(label);
      if (ids) {
        ids.forEach((id) => okrIds.add(id));
      }
    });
    assignedCounts.set(user._id.toString(), okrIds.size);
  });

  return {
    users,
    assignedCounts,
    pagination: {
      page: params.page,
      limit: params.limit,
      totalItems,
      totalPages
    }
  };
}

export async function createUser(input: CreateUserInput) {
  const email = normalizeEmail(input.email);
  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    throw new AppError("This email is already in use.", 409);
  }

  const { firstName, lastName } = parseName(input.fullName);
  const password = input.password?.trim() || generateTempPassword();
  if (input.password) {
    ensureStrongPassword(password);
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = generateVerificationToken();

  const user = await UserModel.create({
    firstName,
    lastName,
    email,
    passwordHash,
    role: input.role ?? "employee",
    department: input.department?.trim(),
    designation: input.designation?.trim(),
    manager: input.manager?.trim(),
    isEmailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: getExpiry(24)
  });

  logInfo("service", `User created by admin: ${user.email}`);
  return { user, verificationToken };
}

export async function bulkCreateUsers(users: CreateUserInput[]) {
  const createdUsers = [];
  for (const entry of users) {
    if (!entry.fullName || !entry.email) {
      throw new AppError("Each user must include fullName and email.", 400);
    }
    const normalizedRole = normalizeRole(entry.role);
    const { user, verificationToken } = await createUser({
      ...entry,
      role: normalizedRole
    });
    createdUsers.push({ user, verificationToken });
  }

  return createdUsers;
}

export async function updateUser(userId: string, updates: UpdateUserInput) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (updates.fullName !== undefined) {
    const { firstName, lastName } = parseName(updates.fullName);
    user.firstName = firstName;
    user.lastName = lastName;
  }

  if (updates.email !== undefined) {
    const email = normalizeEmail(updates.email);
    const existingUser = await UserModel.findOne({ email, _id: { $ne: user._id } });
    if (existingUser) {
      throw new AppError("This email is already in use.", 409);
    }
    user.email = email;
  }

  if (updates.department !== undefined) {
    user.department = updates.department.trim();
  }
  if (updates.designation !== undefined) {
    user.designation = updates.designation.trim();
  }
  if (updates.manager !== undefined) {
    user.manager = updates.manager.trim();
  }

  await user.save();
  logInfo("service", `User updated ${user.email}`);
  return user;
}

export async function updateUserRole(userId: string, role: string) {
  const normalizedRole = normalizeRole(role);
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { role: normalizedRole },
    { new: true }
  );
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  logInfo("service", `Role updated for ${user.email}`);
  return user;
}

export async function bulkUpdateUserRoles(userIds: string[], role: string) {
  const normalizedRole = normalizeRole(role);
  const result = await UserModel.updateMany(
    { _id: { $in: userIds } },
    { $set: { role: normalizedRole } }
  );
  logInfo("service", `Bulk role update for ${result.modifiedCount} users`);
  return result.modifiedCount;
}

export async function deleteUser(userId: string, actor?: TokenPayload) {
  if (!actor) {
    throw new AppError("Unauthorized.", 401);
  }
  if (actor.userId === userId) {
    throw new AppError("You cannot delete your own account.", 403);
  }
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  if (user.role === "admin") {
    throw new AppError("You cannot delete admin accounts.", 403);
  }
  await user.deleteOne();
  logInfo("service", `User deleted ${user.email}`);
  return true;
}

export async function bulkDeleteUsers(userIds: string[], actor?: TokenPayload) {
  if (!actor) {
    throw new AppError("Unauthorized.", 401);
  }
  if (userIds.includes(actor.userId)) {
    throw new AppError("You cannot delete your own account.", 403);
  }
  const users = await UserModel.find({ _id: { $in: userIds } });
  if (users.some((user) => user.role === "admin")) {
    throw new AppError("You cannot delete admin accounts.", 403);
  }
  const result = await UserModel.deleteMany({ _id: { $in: userIds } });
  logInfo("service", `Bulk delete for ${result.deletedCount ?? 0} users`);
  return result.deletedCount ?? 0;
}

export function normalizeRoleInput(role?: string) {
  return normalizeRole(role);
}
