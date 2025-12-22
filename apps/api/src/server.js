const http = require("http");
const app = require("./app");
const { connectMongo } = require("./database/mongo");
const config = require("./config/env");

const PORT = config.port || 4000; // Use config.port (defaults to 4000)
const HOST = "0.0.0.0"; // Bind to all interfaces

console.log("Starting server on host:", HOST, "port:", PORT);

// Always start HTTP server, even if MongoDB connection fails.
// This allows static-demo features (like fixed login users) to work
// even when the database is temporarily unavailable.
const server = http.createServer(app);

server.listen(PORT, HOST, () => {
  console.log(`API server listening on ${HOST}:${PORT}`);
});

// Handle server errors
server.on("error", (error) => {
  console.error("Server error:", error);
});

// Connect to MongoDB in the background (non-blocking for server startup)
connectMongo()
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((error) => {
    console.error(
      "Failed to connect to MongoDB. Chat knowledge-base features may be limited until this is resolved:",
      error.message
    );
  });