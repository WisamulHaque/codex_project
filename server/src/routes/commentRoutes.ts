import { Router } from "express";
import {
  deleteCommentHandler,
  getOkrComments,
  patchComment,
  postCommentReply,
  postOkrComment
} from "../controllers/commentController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/authMiddleware";

export const commentRoutes = Router();

commentRoutes.get("/okrs/:id/comments", requireAuth, asyncHandler(getOkrComments));
commentRoutes.post("/okrs/:id/comments", requireAuth, asyncHandler(postOkrComment));
commentRoutes.patch("/comments/:id", requireAuth, asyncHandler(patchComment));
commentRoutes.delete("/comments/:id", requireAuth, asyncHandler(deleteCommentHandler));
commentRoutes.post("/comments/:id/replies", requireAuth, asyncHandler(postCommentReply));
