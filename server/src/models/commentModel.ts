import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const replySchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    authorEmail: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    mentions: { type: [String], default: [] }
  },
  { timestamps: true }
);

const commentSchema = new Schema(
  {
    okrId: { type: Schema.Types.ObjectId, ref: "Okr", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    authorEmail: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    mentions: { type: [String], default: [] },
    replies: { type: [replySchema], default: [] }
  },
  { timestamps: true }
);

export type CommentReplyDocument = InferSchemaType<typeof replySchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentDocument = InferSchemaType<typeof commentSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  replies: CommentReplyDocument[];
};

export const CommentModel =
  (mongoose.models.Comment as Model<CommentDocument>) ||
  mongoose.model<CommentDocument>("Comment", commentSchema);
