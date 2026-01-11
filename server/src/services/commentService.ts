import mongoose from "mongoose";
import { CommentModel, type CommentDocument, type CommentReplyDocument } from "../models/commentModel";
import { OkrModel } from "../models/okrModel";
import { UserModel } from "../models/userModel";
import { AppError } from "../utils/appError";
import { logInfo } from "../utils/logger";
import { createCommentNotifications, createMentionNotifications } from "./notificationService";

interface AuthorContext {
  userId: string;
  email: string;
}

function extractMentions(message: string) {
  const regex = /@([A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)*)/g;
  const mentions = new Set<string>();
  let match = regex.exec(message);
  while (match) {
    const cleaned = match[1].trim().replace(/[.,!?]+$/, "");
    if (cleaned) {
      mentions.add(cleaned);
    }
    match = regex.exec(message);
  }
  return Array.from(mentions);
}

async function getOkrById(okrId: string) {
  if (!mongoose.Types.ObjectId.isValid(okrId)) {
    throw new AppError("Invalid OKR id.", 400);
  }
  const okr = await OkrModel.findById(okrId);
  if (!okr) {
    throw new AppError("OKR not found.", 404);
  }
  return okr;
}

async function buildAuthor({ userId, email }: AuthorContext) {
  const user = await UserModel.findById(userId);
  const authorName = user ? `${user.firstName} ${user.lastName}`.trim() : email;
  const authorEmail = user?.email ?? email;
  return { authorId: userId, authorName, authorEmail };
}

function mapReply(reply: CommentReplyDocument) {
  return {
    id: reply._id?.toString() ?? "",
    authorName: reply.authorName,
    authorEmail: reply.authorEmail,
    message: reply.message,
    mentions: reply.mentions ?? [],
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt
  };
}

function mapComment(comment: CommentDocument) {
  return {
    id: comment._id.toString(),
    okrId: comment.okrId.toString(),
    authorName: comment.authorName,
    authorEmail: comment.authorEmail,
    message: comment.message,
    mentions: comment.mentions ?? [],
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    replies: comment.replies.map((reply) => mapReply(reply))
  };
}

export async function listCommentsByOkr(okrId: string) {
  logInfo("service", `Listing comments for OKR ${okrId}`);
  await getOkrById(okrId);
  const comments = await CommentModel.find({ okrId }).sort({ createdAt: -1 });
  return comments.map((comment) => mapComment(comment));
}

export async function createComment(okrId: string, message: string, author: AuthorContext) {
  logInfo("service", `Creating comment for OKR ${okrId}`);
  if (!message.trim()) {
    throw new AppError("Comment message is required.", 400);
  }
  const okr = await getOkrById(okrId);
  const authorInfo = await buildAuthor(author);
  const mentions = extractMentions(message);
  const comment = await CommentModel.create({
    okrId,
    ...authorInfo,
    message,
    mentions
  });
  const owners = okr.owners?.length ? okr.owners : okr.owner ? [okr.owner] : [];
  await createCommentNotifications({
    okrId,
    okrObjective: okr.objective,
    owners,
    authorId: author.userId,
    authorName: authorInfo.authorName,
    commentId: comment._id.toString(),
    message,
    mentions
  });
  await createMentionNotifications({
    mentions,
    authorId: author.userId,
    authorName: authorInfo.authorName,
    okrId,
    okrObjective: okr.objective,
    commentId: comment._id.toString(),
    message
  });
  return mapComment(comment);
}

export async function updateCommentMessage(commentId: string, message: string, replyId?: string) {
  logInfo("service", `Updating comment ${commentId}`);
  if (!message.trim()) {
    throw new AppError("Comment message is required.", 400);
  }
  const comment = await CommentModel.findById(commentId);
  if (!comment) {
    throw new AppError("Comment not found.", 404);
  }

  const mentions = extractMentions(message);

  if (replyId) {
    const reply = comment.replies.id(replyId);
    if (!reply) {
      throw new AppError("Reply not found.", 404);
    }
    reply.message = message;
    reply.mentions = mentions;
    reply.updatedAt = new Date();
  } else {
    comment.message = message;
    comment.mentions = mentions;
  }

  await comment.save();
  return mapComment(comment);
}

export async function deleteComment(commentId: string, replyId?: string) {
  logInfo("service", `Deleting comment ${commentId}`);
  const comment = await CommentModel.findById(commentId);
  if (!comment) {
    throw new AppError("Comment not found.", 404);
  }

  if (replyId) {
    const reply = comment.replies.id(replyId);
    if (!reply) {
      throw new AppError("Reply not found.", 404);
    }
    reply.deleteOne();
    await comment.save();
    return mapComment(comment);
  }

  await comment.deleteOne();
  return null;
}

export async function addReply(commentId: string, message: string, author: AuthorContext) {
  logInfo("service", `Creating reply for comment ${commentId}`);
  if (!message.trim()) {
    throw new AppError("Reply message is required.", 400);
  }
  const comment = await CommentModel.findById(commentId);
  if (!comment) {
    throw new AppError("Comment not found.", 404);
  }

  const authorInfo = await buildAuthor(author);
  const mentions = extractMentions(message);
  comment.replies.unshift({
    ...authorInfo,
    message,
    mentions
  });
  await comment.save();
  const okr = await getOkrById(comment.okrId.toString());
  const owners = okr.owners?.length ? okr.owners : okr.owner ? [okr.owner] : [];
  await createCommentNotifications({
    okrId: comment.okrId.toString(),
    okrObjective: okr.objective,
    owners,
    authorId: author.userId,
    authorName: authorInfo.authorName,
    commentId: comment._id.toString(),
    message,
    mentions
  });
  await createMentionNotifications({
    mentions,
    authorId: author.userId,
    authorName: authorInfo.authorName,
    okrId: comment.okrId.toString(),
    okrObjective: okr.objective,
    commentId: comment._id.toString(),
    message
  });
  return mapComment(comment);
}
