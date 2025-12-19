const mongoose = require("mongoose");

const QAPairSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    questionHash: { type: String, index: true }, // For deduplication
    normalizedQuestion: { type: String, index: true }, // For matching
    sourceId: { type: String, required: true, index: true },
    audience: { type: String, enum: ["public", "employee"], default: "public" },
    tags: [{ type: String }],
    category: { type: String },
    language: { type: String, default: "en" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QAPair", QAPairSchema);