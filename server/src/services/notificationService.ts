import mongoose from "mongoose";
import { NotificationModel } from "../models/notificationModel";
import { CommentModel } from "../models/commentModel";
import { UserModel, type UserDocument } from "../models/userModel";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";

export type NotificationType = "mention" | "owner" | "progress" | "comment";

interface NotificationPreferencesInput {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

interface NotificationCreateInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  contextLabel?: string;
  contextId?: string;
}

function ensureValidId(id: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label} id.`, 400);
  }
}

function mapNotification(
  notification: Awaited<ReturnType<typeof NotificationModel.findById>>,
  overrides?: { contextLabel?: string; contextId?: string }
) {
  if (!notification) {
    throw new AppError("Notification not found.", 404);
  }
  return {
    id: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    contextLabel: overrides?.contextLabel ?? notification.contextLabel,
    contextId: overrides?.contextId ?? notification.contextId,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString()
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function userMatchesLabel(user: UserDocument, label: string) {
  const normalized = normalizeLabel(label);
  const fullName = `${user.firstName} ${user.lastName}`.trim().toLowerCase();
  const email = user.email.toLowerCase();
  const emailPrefix = email.split("@")[0] ?? "";

  return (
    normalized === email ||
    normalized === emailPrefix ||
    normalized === user.firstName.toLowerCase() ||
    normalized === user.lastName.toLowerCase() ||
    normalized === fullName
  );
}

async function resolveUsersByLabels(labels: string[]) {
  const cleaned = Array.from(
    new Set(labels.map((label) => label.trim()).filter((label) => label.length > 0))
  );
  if (!cleaned.length) {
    return [];
  }

  const orConditions = cleaned.flatMap((label) => {
    const regex = new RegExp(escapeRegex(label), "i");
    const conditions: Array<Record<string, unknown>> = [
      { email: regex },
      { firstName: regex },
      { lastName: regex }
    ];

    const parts = label.trim().split(/\s+/);
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];
      conditions.push({
        $and: [
          { firstName: new RegExp(`^${escapeRegex(firstName)}$`, "i") },
          { lastName: new RegExp(`^${escapeRegex(lastName)}$`, "i") }
        ]
      });
    }

    return conditions;
  });

  const candidates = await UserModel.find({ $or: orConditions });
  return candidates.filter((user) => cleaned.some((label) => userMatchesLabel(user, label)));
}

function uniqueUsers(users: UserDocument[]) {
  const seen = new Set<string>();
  return users.filter((user) => {
    const id = user._id.toString();
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

async function createNotifications(items: NotificationCreateInput[]) {
  if (!items.length) {
    return [];
  }
  await NotificationModel.insertMany(items, { ordered: false });
  return items.length;
}

export async function createMentionNotifications(input: {
  mentions: string[];
  authorId: string;
  authorName: string;
  okrId: string;
  okrObjective: string;
  commentId: string;
  message: string;
}) {
  if (!input.mentions.length) {
    return 0;
  }

  const users = await resolveUsersByLabels(input.mentions);
  const recipients = uniqueUsers(users.filter((user) => user._id.toString() !== input.authorId));
  const snippet = input.message.length > 120 ? `${input.message.slice(0, 117)}...` : input.message;

  return createNotifications(
    recipients.map((user) => ({
      userId: user._id.toString(),
      type: "mention",
      title: "You were mentioned",
      message: `${input.authorName} mentioned you on "${input.okrObjective}": ${snippet}`,
      contextLabel: "OKR",
      contextId: input.okrId
    }))
  );
}

export async function createOwnerChangeNotifications(input: {
  okrId: string;
  okrObjective: string;
  addedOwners: string[];
  removedOwners: string[];
}) {
  const notifications: NotificationCreateInput[] = [];

  if (input.addedOwners.length) {
    const addedUsers = uniqueUsers(await resolveUsersByLabels(input.addedOwners));
    notifications.push(
      ...addedUsers.map((user) => ({
        userId: user._id.toString(),
        type: "owner",
        title: "You were added as an OKR owner",
        message: `You are now an owner for "${input.okrObjective}".`,
        contextLabel: "OKR",
        contextId: input.okrId
      }))
    );
  }

  if (input.removedOwners.length) {
    const removedUsers = uniqueUsers(await resolveUsersByLabels(input.removedOwners));
    notifications.push(
      ...removedUsers.map((user) => ({
        userId: user._id.toString(),
        type: "owner",
        title: "You were removed as an OKR owner",
        message: `You are no longer an owner for "${input.okrObjective}".`,
        contextLabel: "OKR",
        contextId: input.okrId
      }))
    );
  }

  return createNotifications(notifications);
}

export async function createCommentNotifications(input: {
  okrId: string;
  okrObjective: string;
  owners: string[];
  authorId: string;
  authorName: string;
  commentId: string;
  message: string;
  mentions?: string[];
}) {
  if (!input.owners.length) {
    return 0;
  }

  const owners = uniqueUsers(await resolveUsersByLabels(input.owners));
  const mentionUsers = input.mentions?.length ? uniqueUsers(await resolveUsersByLabels(input.mentions)) : [];
  const mentionIds = new Set(mentionUsers.map((user) => user._id.toString()));
  const recipients = owners.filter(
    (user) => user._id.toString() !== input.authorId && !mentionIds.has(user._id.toString())
  );

  if (!recipients.length) {
    return 0;
  }

  const snippet = input.message.length > 120 ? `${input.message.slice(0, 117)}...` : input.message;
  return createNotifications(
    recipients.map((user) => ({
      userId: user._id.toString(),
      type: "comment",
      title: "New comment on your OKR",
      message: `${input.authorName} commented on "${input.okrObjective}": ${snippet}`,
      contextLabel: "OKR",
      contextId: input.okrId
    }))
  );
}

export async function createProgressNotifications(input: {
  okrId: string;
  okrObjective: string;
  owners: string[];
  message: string;
  contextLabel?: string;
  contextId?: string;
}) {
  if (!input.owners.length) {
    return 0;
  }

  const owners = uniqueUsers(await resolveUsersByLabels(input.owners));
  return createNotifications(
    owners.map((user) => ({
      userId: user._id.toString(),
      type: "progress",
      title: "OKR progress updated",
      message: input.message,
      contextLabel: input.contextLabel ?? "OKR",
      contextId: input.contextId ?? input.okrId
    }))
  );
}

export async function listNotifications(userId: string) {
  logInfo("service", `Listing notifications for user ${userId}`);
  ensureValidId(userId, "user");
  const notifications = await NotificationModel.find({ userId }).sort({ createdAt: -1 });
  const commentIds = notifications
    .filter((notification) => (notification.contextLabel ?? "").toLowerCase() === "comment")
    .map((notification) => notification.contextId ?? "")
    .filter((id) => mongoose.Types.ObjectId.isValid(id)) as string[];

  const commentMap = new Map<string, string>();
  if (commentIds.length) {
    const comments = await CommentModel.find({ _id: { $in: commentIds } }, { okrId: 1 });
    comments.forEach((comment) => {
      commentMap.set(comment._id.toString(), comment.okrId.toString());
    });
  }

  return notifications.map((notification) => {
    const label = (notification.contextLabel ?? "").toLowerCase();
    if (label === "comment" && notification.contextId) {
      const okrId = commentMap.get(notification.contextId);
      if (okrId) {
        return mapNotification(notification, { contextLabel: "OKR", contextId: okrId });
      }
    }
    return mapNotification(notification);
  });
}

export async function countUnreadNotifications(userId: string) {
  logInfo("service", `Counting unread notifications for user ${userId}`);
  ensureValidId(userId, "user");
  return NotificationModel.countDocuments({ userId, isRead: false });
}

export async function markNotificationsRead(userId: string, ids?: string[], markAll?: boolean) {
  logInfo("service", `Marking notifications read for user ${userId}`);
  ensureValidId(userId, "user");

  if (markAll) {
    const result = await NotificationModel.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
    return result.modifiedCount ?? 0;
  }

  if (!ids?.length) {
    throw new AppError("Notification ids are required.", 400);
  }

  ids.forEach((id) => ensureValidId(id, "notification"));
  const result = await NotificationModel.updateMany(
    { userId, _id: { $in: ids } },
    { $set: { isRead: true } }
  );
  return result.modifiedCount ?? 0;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  logInfo("service", `Marking notification ${notificationId} read`);
  ensureValidId(userId, "user");
  ensureValidId(notificationId, "notification");
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true } },
    { new: true }
  );
  return mapNotification(notification);
}

export async function updateNotificationPreferences(userId: string, input: NotificationPreferencesInput) {
  logInfo("service", `Updating notification preferences for user ${userId}`);
  ensureValidId(userId, "user");

  const updates: NotificationPreferencesInput = {};
  if (typeof input.emailNotifications === "boolean") {
    updates.emailNotifications = input.emailNotifications;
  }
  if (typeof input.pushNotifications === "boolean") {
    updates.pushNotifications = input.pushNotifications;
  }

  if (!Object.keys(updates).length) {
    throw new AppError("Notification preferences are required.", 400);
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const current = user.notificationPreferences ?? {
    emailNotifications: true,
    pushNotifications: true
  };

  user.notificationPreferences = {
    emailNotifications: updates.emailNotifications ?? current.emailNotifications,
    pushNotifications: updates.pushNotifications ?? current.pushNotifications
  };

  await user.save();

  return user.notificationPreferences;
}
