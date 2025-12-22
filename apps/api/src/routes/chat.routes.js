const express = require("express");
const { handleMessage } = require("../controllers/chatController");
const { authenticateOptional } = require("../middlewares/auth");

const router = express.Router();

// Chat message endpoint
// Public + authenticated dono ke liye:
// - Agar token hai ⇒ req.user set ho jayega (client/employee/admin)
// - Agar nahi hai ⇒ anonymous client (public-only access)
router.post("/message", authenticateOptional, handleMessage);

module.exports = router;


