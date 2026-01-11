import { Request, Response } from "express";
import {
  addReply,
  createComment,
  deleteComment,
  listCommentsByOkr,
  updateCommentMessage
} from "../services/commentService";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";

function getAuthorContext(request: Request) {
  const userId = request.user?.userId;
  const email = request.user?.email;
  if (!userId || !email) {
    throw new AppError("Unauthorized.", 401);
  }
  return { userId, email };
}

export async function getOkrComments(request: Request, response: Response) {
  logInfo("route", "GET /okrs/:id/comments");
  const comments = await listCommentsByOkr(request.params.id);
  return response.status(200).json({ data: comments });
}

export async function postOkrComment(request: Request, response: Response) {
  logInfo("route", "POST /okrs/:id/comments");
  const message = request.body?.message;
  if (typeof message !== "string" || !message.trim()) {
    throw new AppError("Comment message is required.", 400);
  }
  const comment = await createComment(request.params.id, message, getAuthorContext(request));
  return response.status(201).json({ data: comment, message: "Comment added." });
}

export async function patchComment(request: Request, response: Response) {
  logInfo("route", "PATCH /comments/:id");
  const message = request.body?.message;
  if (typeof message !== "string" || !message.trim()) {
    throw new AppError("Comment message is required.", 400);
  }
  const replyId =
    typeof request.body?.replyId === "string"
      ? request.body.replyId
      : typeof request.query?.replyId === "string"
      ? request.query.replyId
      : undefined;
  const comment = await updateCommentMessage(request.params.id, message, replyId);
  return response.status(200).json({ data: comment, message: "Comment updated successfully." });
}

export async function deleteCommentHandler(request: Request, response: Response) {
  logInfo("route", "DELETE /comments/:id");
  const replyId =
    typeof request.body?.replyId === "string"
      ? request.body.replyId
      : typeof request.query?.replyId === "string"
      ? request.query.replyId
      : undefined;
  const comment = await deleteComment(request.params.id, replyId);
  if (comment) {
    return response.status(200).json({ data: comment, message: "Reply deleted successfully." });
  }
  return response.status(200).json({ message: "Comment deleted successfully." });
}

export async function postCommentReply(request: Request, response: Response) {
  logInfo("route", "POST /comments/:id/replies");
  const message = request.body?.message;
  if (typeof message !== "string" || !message.trim()) {
    throw new AppError("Reply message is required.", 400);
  }
  const comment = await addReply(request.params.id, message, getAuthorContext(request));
  return response.status(201).json({ data: comment, message: "Reply added." });
}
