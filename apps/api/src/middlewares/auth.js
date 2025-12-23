const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "mobiloitte_chatbot_secret_key";


function authenticateOptional(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.toString().startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.toString().replace("Bearer ", "").trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role || "client",
      employeeId: decoded.employeeId || null,
    };
  } catch (err) {
    // Invalid token ⇒ treat as anonymous, do not block
    console.warn("authenticateOptional: invalid token, proceeding as anonymous:", err.message);
  }
  return next();
}

/**
 * Require authenticated user (any role)
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.toString().startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.toString().replace("Bearer ", "").trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role || "client",
      employeeId: decoded.employeeId || null,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Require employee role
 */
function requireEmployee(req, res, next) {
  requireAuth(req, res, function () {
    if (req.user.role !== "employee") {
      return res.status(403).json({ message: "Employee role required" });
    }
    return next();
  });
}

/**
 * Require admin role
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, function () {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin role required" });
    }
    return next();
  });
}

module.exports = {
  authenticateOptional,
  requireAuth,
  requireEmployee,
  requireAdmin,
};

