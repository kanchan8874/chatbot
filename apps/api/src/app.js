const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const routes = require("./routes");

console.log("Loading routes...");

const app = express();

// Enable CORS for all origins (in production, restrict to specific origins)
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Logging middleware
app.use(morgan("dev"));

// API routes
app.use("/api", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "chatbot-api" });
});

console.log("Routes loaded successfully");

module.exports = app;