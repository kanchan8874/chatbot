const IngestionJob = require("../database/models/IngestionJob");
const QAPair = require("../database/models/QAPair");

// Get all ingestion jobs with pagination
async function getIngestionJobs(req, res) {
  try {
    const { page = 1, limit = 10, status, sourceType } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (sourceType) filter.sourceType = sourceType;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get jobs
    const jobs = await IngestionJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await IngestionJob.countDocuments(filter);
    
    return res.json({
      jobs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch ingestion jobs",
      error: error.message
    });
  }
}

// Get job details by ID
async function getIngestionJobById(req, res) {
  try {
    const { id } = req.params;
    
    const job = await IngestionJob.findById(id);
    if (!job) {
      return res.status(404).json({
        message: "Ingestion job not found"
      });
    }
    
    // Get related QA pairs if it's a CSV job
    let qaPairs = [];
    if (job.sourceType === "csv") {
      qaPairs = await QAPair.find({ sourceId: job.sourceId })
        .limit(50); // Limit to 50 for performance
    }
    
    return res.json({
      job,
      qaPairs: qaPairs.length > 0 ? qaPairs : undefined
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch ingestion job",
      error: error.message
    });
  }
}

// Retry failed ingestion job
async function retryIngestionJob(req, res) {
  try {
    const { id } = req.params;
    
    const job = await IngestionJob.findById(id);
    if (!job) {
      return res.status(404).json({
        message: "Ingestion job not found"
      });
    }
    
    if (job.status !== "failed") {
      return res.status(400).json({
        message: "Only failed jobs can be retried"
      });
    }
    
    // Reset job status to queued
    job.status = "queued";
    job.errorMessage = undefined;
    await job.save();
    
    // In a real implementation, you would trigger the actual reprocessing
    // For now, we'll just update the status
    
    return res.json({
      message: "Job retry initiated",
      job
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retry ingestion job",
      error: error.message
    });
  }
}

// Cancel ongoing ingestion job
async function cancelIngestionJob(req, res) {
  try {
    const { id } = req.params;
    
    const job = await IngestionJob.findById(id);
    if (!job) {
      return res.status(404).json({
        message: "Ingestion job not found"
      });
    }
    
    if (job.status === "completed" || job.status === "failed") {
      return res.status(400).json({
        message: "Completed or failed jobs cannot be cancelled"
      });
    }
    
    // Update job status to cancelled
    job.status = "failed";
    job.errorMessage = "Cancelled by admin";
    await job.save();
    
    return res.json({
      message: "Job cancelled successfully",
      job
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to cancel ingestion job",
      error: error.message
    });
  }
}

// Get system statistics
async function getSystemStats(req, res) {
  try {
    // Get counts by status
    const statusCounts = await IngestionJob.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get counts by source type
    const sourceTypeCounts = await IngestionJob.aggregate([
      {
        $group: {
          _id: "$sourceType",
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get total QA pairs
    const totalQAPairs = await QAPair.countDocuments();
    
    // Get recent jobs (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentJobs = await IngestionJob.countDocuments({
      createdAt: { $gte: twentyFourHoursAgo }
    });
    
    return res.json({
      stats: {
        totalJobs: await IngestionJob.countDocuments(),
        totalQAPairs,
        recentJobs,
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        sourceTypeCounts: sourceTypeCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch system statistics",
      error: error.message
    });
  }
}

module.exports = {
  getIngestionJobs,
  getIngestionJobById,
  retryIngestionJob,
  cancelIngestionJob,
  getSystemStats
};