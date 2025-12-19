const mongoose = require("mongoose");

const DocumentChunkSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true, unique: true },
    chunkText: { type: String, required: true },
    sourceId: { type: String, required: true, index: true },
    audience: { type: String, enum: ["public", "employee"], default: "public" },
    url: { type: String },
    page: { type: Number },
    title: { type: String },
    headingPath: { type: String }, // e.g., Services > AI > Chatbots
    department: { type: String },
    tags: [{ type: String }],
    language: { type: String, default: "en" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DocumentChunk", DocumentChunkSchema);