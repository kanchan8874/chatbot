const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || "mobiloitte_chatbot_secret_key";


const STATIC_USERS = [
  {
    id: "1",
    name: "Mobiloitte Client",
    email: "client@mobiloitte.com",
    password: "client123",
    role: "client",
    employeeId: null,
  },
  {
    id: "2",
    name: "Mobiloitte HR",
    email: "hr@mobiloitte.com",
    password: "hr123",
    role: "employee",
    employeeId: "EMP001",
  },
  {
    id: "3",
    name: "Mobiloitte Admin",
    email: "admin@mobiloitte.com",
    password: "admin123",
    role: "admin",
    employeeId: null,
  },
];

// Helper to generate JWT from user object
function generateTokenFromUser(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "client",
      employeeId: user.employeeId || null,
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

// Helper to sanitize user object for response
function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "client",
    employeeId: user.employeeId || null,
  };
}

// Registration is disabled in this static-demo phase
router.post("/register", (req, res) => {
  return res.status(403).json({
    message: "Registration is disabled in this demo. Please use one of the provided demo accounts.",
  });
});

// Login route (uses 3 static users)
router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = STATIC_USERS.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === password
    );
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    const token = generateTokenFromUser(user);
    
    return res.json({ 
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ 
      message: "Login failed", 
      error: error.message,
    });
  }
});

// Google login route (mapped to client demo account)
router.post("/google-login", (req, res) => {
  try {
    const clientUser = STATIC_USERS.find((u) => u.role === "client");
    const token = generateTokenFromUser(clientUser);
    
    return res.json({ 
      message: "Google login demo successful (mapped to client role).",
      token,
      user: sanitizeUser(clientUser),
    });
  } catch (error) {
    return res.status(500).json({ 
      message: "Google login failed", 
      error: error.message,
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
        name: decoded.name,
        role: decoded.role || "client",
        employeeId: decoded.employeeId || null,
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