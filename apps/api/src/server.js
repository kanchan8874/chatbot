const http = require("http");
const app = require("./app");
const { connectMongo } = require("./database/mongo");

const PORT = process.env.PORT || 4000; // Changed to 4000 to match frontend config
const HOST = '0.0.0.0'; // Bind to all interfaces

console.log("Starting server on host:", HOST, "port:", PORT);

// Connect to MongoDB
connectMongo()
  .then(() => {
    console.log("Connected to MongoDB successfully");
    
    const server = http.createServer(app);
    
    server.listen(PORT, HOST, () => {
      console.log(`API server listening on ${HOST}:${PORT}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  });