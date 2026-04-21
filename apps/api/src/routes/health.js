const express = require("express");

const router = express.Router();

function getHealth(_req, res) {
  res.json({
    status: "ok",
    service: "ecosentinel-api",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
}

router.get("/", getHealth);

module.exports = {
  getHealth,
  router
};
