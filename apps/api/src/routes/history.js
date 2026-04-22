const express = require("express");

const pool = require("../db/pool");

const router = express.Router();

function parseCoordinate(value, fallback) {
  const parsed = Number.parseFloat(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHours(value) {
  const parsed = Number.parseInt(value ?? 24, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, 168);
}

async function getHistory(req, res) {
  const lat = parseCoordinate(req.query.lat, 52.3676);
  const lng = parseCoordinate(req.query.lng, 4.9041);
  const hours = parseHours(req.query.hours);

  if (lat == null || lng == null || hours == null) {
    return res.status(400).json({
      error: "lat, lng, and hours must be valid numbers"
    });
  }

  const query = `
    SELECT recorded_at AS timestamp, aqi, pm25, pm10, no2, o3, source
    FROM aqi_readings
    WHERE lat BETWEEN $1 - 0.05 AND $1 + 0.05
      AND lng BETWEEN $2 - 0.05 AND $2 + 0.05
      AND recorded_at >= NOW() - ($3::text || ' hours')::interval
    ORDER BY recorded_at ASC
  `;

  const result = await pool.query(query, [lat, lng, String(hours)]);
  return res.json(result.rows);
}

router.get("/", (req, res, next) => {
  getHistory(req, res).catch(next);
});

module.exports = {
  getHistory,
  router
};
