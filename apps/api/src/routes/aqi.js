const express = require("express");

const pool = require("../db/pool");
const { aqiToCategory, aqiToColor } = require("../services/AQINormaliser");

const router = express.Router();

function parseCoordinate(value, fallback) {
  const parsed = Number.parseFloat(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRadius(value) {
  const parsed = Number.parseFloat(value ?? 5);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function getCurrentAqi(req, res) {
  const lat = parseCoordinate(req.query.lat, 52.3676);
  const lng = parseCoordinate(req.query.lng, 4.9041);
  const radiusKm = parseRadius(req.query.radius_km);

  if (lat == null || lng == null || radiusKm == null) {
    return res.status(400).json({
      error: "lat, lng, and radius_km must be valid numbers"
    });
  }

  const degreesRadius = radiusKm / 111;
  const query = `
    SELECT lat, lng, aqi, category, pm25, pm10, no2, o3, source, recorded_at
    FROM aqi_readings
    WHERE lat BETWEEN $1::double precision - $3::double precision
      AND $1::double precision + $3::double precision
      AND lng BETWEEN $2::double precision - $3::double precision
      AND $2::double precision + $3::double precision
    ORDER BY POWER(lat - $1::double precision, 2) + POWER(lng - $2::double precision, 2), recorded_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [lat, lng, degreesRadius]);
  const row = result.rows[0];

  if (!row) {
    return res.status(404).json({
      error: "No AQI readings found for the requested location"
    });
  }

  return res.json({
    lat: row.lat,
    lng: row.lng,
    aqi: row.aqi,
    category: row.category || aqiToCategory(row.aqi),
    color: aqiToColor(row.aqi),
    pollutants: {
      pm25: row.pm25,
      pm10: row.pm10,
      no2: row.no2,
      o3: row.o3
    },
    source: row.source,
    timestamp: row.recorded_at
  });
}

router.get("/", (req, res, next) => {
  getCurrentAqi(req, res).catch(next);
});

module.exports = {
  getCurrentAqi,
  router
};
