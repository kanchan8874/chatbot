const express = require("express");
const authRoutes = require("./auth.routes");
const ingestRoutes = require("./ingest.routes");
const chatRoutes = require("./chat.routes");
const adminRoutes = require("./admin.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/ingest", ingestRoutes);
router.use("/chat", chatRoutes);
router.use("/admin", adminRoutes);

module.exports = router;