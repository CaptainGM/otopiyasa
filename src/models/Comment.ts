import mongoose, { Schema, models, model } from "mongoose";

const CommentSchema = new Schema(
  {
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

CommentSchema.index({ car: 1, createdAt: -1 });

export const Comment = models.Comment || model("Comment", CommentSchema);

export type CommentDocument = mongoose.InferSchemaType<typeof CommentSchema> & {
  _id: mongoose.Types.ObjectId;
};
