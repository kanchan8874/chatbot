const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || "mobiloitte_chatbot_secret_key";

// Placeholder user data (in production, this would come from a database)
const users = [
  {
    id: 1,
    email: "user@example.com",
    password: "password123", // In production, this should be hashed
    name: "Test User"
  },
  {
    id: 2,
    email: "google.user@example.com",
    password: "password123", // In production, this should be hashed
    name: "Google User"
  }
];

// Login route
router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user (in production, query database)
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid email or password" 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name
      }, 
      JWT_SECRET, 
      { expiresIn: "24h" }
    );
    
    return res.json({ 
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      message: "Login failed", 
      error: error.message 
    });
  }
});

// Google login route (placeholder)
router.post("/google-login", (req, res) => {
  try {
    // In a real implementation, you would verify the Google token
    // and create/get user from database
    
    const { googleToken } = req.body;
    
    // For demo purposes, we'll create a mock user
    const user = {
      id: 2,
      email: "google.user@example.com",
      name: "Google User"
    };
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name
      }, 
      JWT_SECRET, 
      { expiresIn: "24h" }
    );
    
    return res.json({ 
      message: "Google login successful",
      token,
      user
    });
  } catch (error) {
    return res.status(500).json({ 
      message: "Google login failed", 
      error: error.message 
    });
  }
});

// Verify token route
router.post("/verify-token", (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(401).json({ 
        message: "No token provided" 
      });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    return res.json({ 
      valid: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.name
      }
    });
  } catch (error) {
    return res.status(401).json({ 
      valid: false,
      message: "Invalid token" 
    });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  try {
    // In a real implementation, you might want to:
    // 1. Add the token to a blacklist in database/cache
    // 2. Clear any server-side session data
    
    // For JWT-based auth, we can't actually invalidate the token
    // but we can return a success response to indicate logout
    return res.json({ 
      message: "Logout successful" 
    });
  } catch (error) {
    return res.status(500).json({ 
      message: "Logout failed", 
      error: error.message 
    });
  }
});

module.exports = router;