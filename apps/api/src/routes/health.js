const express = require("express");

const pool = require("../db/pool");

const router = express.Router();

async function getHealth(_req, res) {
  const collector = process.env.ENABLE_COLLECTOR !== "false" ? "enabled" : "disabled";

  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      collector,
      service: "ecosentinel-api",
      version: "0.1.0",
      db: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    res.status(503).json({
      status: "degraded",
      collector,
      service: "ecosentinel-api",
      version: "0.1.0",
      db: "disconnected",
      timestamp: new Date().toISOString()
    });
  }
}

router.get("/", getHealth);

module.exports = {
  getHealth,
  router
};
