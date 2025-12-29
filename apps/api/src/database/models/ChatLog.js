const mongoose = require("mongoose");

const ChatLogSchema = new mongoose.Schema(
  {
    role: { type: String },
    intent: { type: String },
    contextType: { type: String },
    topScore: { type: Number },
    hasHandover: { type: Boolean, default: false },
    latencyMs: { type: Number },
    sessionId: { type: String },
    message: { type: String },
    handoverIntent: { type: String },
    sources: [
      {
        id: String,
        source_id: String,
        url: String,
        title: String,
        page: Number,
        heading_path: String,
        score: Number,
        note: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatLog", ChatLogSchema);

