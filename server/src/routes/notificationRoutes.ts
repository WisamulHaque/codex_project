import { Router } from "express";
import {
  getNotifications,
  getUnreadNotificationCount,
  patchNotificationPreferences,
  patchNotificationRead,
  patchNotificationsRead
} from "../controllers/notificationController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/authMiddleware";

export const notificationRoutes = Router();

notificationRoutes.get("/notifications", requireAuth, asyncHandler(getNotifications));
notificationRoutes.get("/notifications/unread-count", requireAuth, asyncHandler(getUnreadNotificationCount));
notificationRoutes.patch("/notifications/read", requireAuth, asyncHandler(patchNotificationsRead));
notificationRoutes.patch("/notifications/:id/read", requireAuth, asyncHandler(patchNotificationRead));
notificationRoutes.patch("/notifications/preferences", requireAuth, asyncHandler(patchNotificationPreferences));
