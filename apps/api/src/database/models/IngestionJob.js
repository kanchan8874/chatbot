const mongoose = require("mongoose");

const IngestionJobSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true, index: true },
    sourceType: { type: String, required: true }, // csv, doc, web
    audience: { type: String, required: true }, // public, employee
    status: { type: String, required: true }, // queued, processing, indexed, failed
    version: { type: String, default: "v1" },
    metadata: { type: Object },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IngestionJob", IngestionJobSchema);


