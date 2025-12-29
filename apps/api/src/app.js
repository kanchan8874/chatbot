const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const routes = require("./routes");

console.log("Loading routes...");

const app = express();

// Enable CORS for local development and specific origins
const corsOptions = {
  origin: [
    'http://localhost:3000',  // Next.js default port
    'http://localhost:3001',  // Alternative Next.js port
    'http://localhost:3002',  // Another alternative Next.js port
    'http://localhost:3003',  // Another alternative Next.js port
    'http://localhost:3004',  // Another alternative Next.js port
    process.env.FRONTEND_URL,   // Environment variable for production
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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