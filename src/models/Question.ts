import mongoose, { Schema, models, model } from "mongoose";


const QuestionSchema = new Schema(
  {
    car: { type: Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    
    asker: { type: Schema.Types.ObjectId, ref: "User", required: true },
   
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    text: { type: String, required: true, trim: true, maxlength: 1000 },

   
    answer: { type: String, default: "", maxlength: 1000 },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

QuestionSchema.index({ car: 1, createdAt: -1 });

export const Question = models.Question || model("Question", QuestionSchema);

export type QuestionDocument = mongoose.InferSchemaType<typeof QuestionSchema> & {
  _id: mongoose.Types.ObjectId;
};
