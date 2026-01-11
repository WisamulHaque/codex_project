import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
import {
  getCurrentUser,
  updateCurrentAvatar,
  updateCurrentPassword,
  updateCurrentUser
} from "../controllers/userController";
import {
  bulkCreateUsersHandler,
  bulkDeleteUsersHandler,
  bulkUpdateRolesHandler,
  createUserHandler,
  deleteUserHandler,
  listUsersHandler,
  updateUserHandler,
  updateUserRoleHandler
} from "../controllers/userManagementController";

export const userRoutes = Router();

userRoutes.get("/users/me", requireAuth, asyncHandler(getCurrentUser));
userRoutes.patch("/users/me", requireAuth, asyncHandler(updateCurrentUser));
userRoutes.patch("/users/me/password", requireAuth, asyncHandler(updateCurrentPassword));
userRoutes.post("/users/me/avatar", requireAuth, asyncHandler(updateCurrentAvatar));

userRoutes.get("/users", requireAuth, asyncHandler(listUsersHandler));
userRoutes.post("/users", requireAuth, requireRole(["admin"]), asyncHandler(createUserHandler));
userRoutes.post("/users/bulk", requireAuth, requireRole(["admin"]), asyncHandler(bulkCreateUsersHandler));
userRoutes.patch("/users/:id", requireAuth, requireRole(["admin"]), asyncHandler(updateUserHandler));
userRoutes.patch("/users/:id/role", requireAuth, requireRole(["admin"]), asyncHandler(updateUserRoleHandler));
userRoutes.patch("/users/roles/bulk", requireAuth, requireRole(["admin"]), asyncHandler(bulkUpdateRolesHandler));
userRoutes.delete("/users/:id", requireAuth, requireRole(["admin"]), asyncHandler(deleteUserHandler));
userRoutes.post("/users/:id/delete", requireAuth, requireRole(["admin"]), asyncHandler(deleteUserHandler));
userRoutes.delete("/users/bulk", requireAuth, requireRole(["admin"]), asyncHandler(bulkDeleteUsersHandler));
userRoutes.post("/users/bulk-delete", requireAuth, requireRole(["admin"]), asyncHandler(bulkDeleteUsersHandler));
