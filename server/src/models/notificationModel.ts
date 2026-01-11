import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["mention", "owner", "progress", "comment"], required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    contextLabel: { type: String, trim: true },
    contextId: { type: String, trim: true },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const NotificationModel =
  (mongoose.models.Notification as Model<NotificationDocument>) ||
  mongoose.model<NotificationDocument>("Notification", notificationSchema);
