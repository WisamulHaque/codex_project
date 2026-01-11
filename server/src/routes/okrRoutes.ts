import { Router } from "express";
import {
  cloneOkrHandler,
  deleteOkrHandler,
  getOkr,
  getOkrs,
  patchOkr,
  postOkr,
  updateKeyResultStatusHandler,
  updateOkrOwnersHandler
} from "../controllers/okrController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/authMiddleware";

export const okrRoutes = Router();

okrRoutes.get("/okrs", requireAuth, asyncHandler(getOkrs));
okrRoutes.post("/okrs", requireAuth, asyncHandler(postOkr));
okrRoutes.get("/okrs/:id", requireAuth, asyncHandler(getOkr));
okrRoutes.patch("/okrs/:id", requireAuth, asyncHandler(patchOkr));
okrRoutes.delete("/okrs/:id", requireAuth, asyncHandler(deleteOkrHandler));
okrRoutes.post("/okrs/:id/clone", requireAuth, asyncHandler(cloneOkrHandler));
okrRoutes.patch(
  "/okrs/:id/key-results/:krId/status",
  requireAuth,
  asyncHandler(updateKeyResultStatusHandler)
);
okrRoutes.patch("/okrs/:id/owners", requireAuth, asyncHandler(updateOkrOwnersHandler));
