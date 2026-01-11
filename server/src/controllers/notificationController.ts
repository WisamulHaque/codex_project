import type { Request, Response } from "express";
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationRead,
  markNotificationsRead,
  updateNotificationPreferences
} from "../services/notificationService";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";

function getUserId(request: Request) {
  const userId = request.user?.userId;
  if (!userId) {
    throw new AppError("Unauthorized.", 401);
  }
  return userId;
}

export async function getNotifications(request: Request, response: Response) {
  logInfo("route", "GET /notifications");
  const userId = getUserId(request);
  const notifications = await listNotifications(userId);
  return response.status(200).json({ data: notifications });
}

export async function getUnreadNotificationCount(request: Request, response: Response) {
  logInfo("route", "GET /notifications/unread-count");
  const userId = getUserId(request);
  const count = await countUnreadNotifications(userId);
  return response.status(200).json({ data: { count } });
}

export async function patchNotificationsRead(request: Request, response: Response) {
  logInfo("route", "PATCH /notifications/read");
  const userId = getUserId(request);
  const { ids, markAll } = request.body ?? {};
  const updatedCount = await markNotificationsRead(userId, ids, markAll);
  return response.status(200).json({ message: "Notifications updated.", data: { updatedCount } });
}

export async function patchNotificationRead(request: Request, response: Response) {
  logInfo("route", "PATCH /notifications/:id/read");
  const userId = getUserId(request);
  const notification = await markNotificationRead(userId, request.params.id);
  return response.status(200).json({ message: "Notification marked as read.", data: notification });
}

export async function patchNotificationPreferences(request: Request, response: Response) {
  logInfo("route", "PATCH /notifications/preferences");
  const userId = getUserId(request);
  const { emailNotifications, pushNotifications } = request.body ?? {};
  const preferences = await updateNotificationPreferences(userId, {
    emailNotifications,
    pushNotifications
  });
  return response
    .status(200)
    .json({ message: "Notification preferences updated successfully!", data: preferences });
}
