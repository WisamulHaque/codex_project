import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const keyResultSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    measurementScale: { type: String, enum: ["percentage", "numeric"], default: "percentage" },
    current: { type: Number, default: 0 },
    target: { type: Number, default: 0 },
    owner: { type: String, trim: true },
    dueDate: { type: String, trim: true },
    status: { type: String, enum: ["onTrack", "atRisk", "offTrack", "completed"], default: "onTrack" }
  },
  { timestamps: false }
);

const okrSchema = new Schema(
  {
    objective: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    owners: { type: [String], default: [] },
    owner: { type: String, trim: true },
    createdBy: { type: String, trim: true },
    dueDate: { type: String, required: true },
    category: { type: String, trim: true },
    vertical: { type: String, trim: true },
    status: { type: String, enum: ["onTrack", "atRisk", "offTrack"], default: "onTrack" },
    progress: { type: Number, default: 0 },
    keyResults: { type: [keyResultSchema], default: [] }
  },
  { timestamps: true }
);

export type OkrDocument = InferSchemaType<typeof okrSchema> & { _id: mongoose.Types.ObjectId };

export const OkrModel =
  (mongoose.models.Okr as Model<OkrDocument>) || mongoose.model<OkrDocument>("Okr", okrSchema);
