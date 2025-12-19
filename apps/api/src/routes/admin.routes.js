const express = require("express");
const {
  getIngestionJobs,
  getIngestionJobById,
  retryIngestionJob,
  cancelIngestionJob,
  getSystemStats
} = require("../controllers/adminController");

const router = express.Router();

// Admin routes for monitoring ingestion jobs
router.get("/jobs", getIngestionJobs);
router.get("/jobs/:id", getIngestionJobById);
router.post("/jobs/:id/retry", retryIngestionJob);
router.post("/jobs/:id/cancel", cancelIngestionJob);
router.get("/stats", getSystemStats);

module.exports = router;