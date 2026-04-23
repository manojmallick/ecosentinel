const express = require("express");

const { aqiToCategory, aqiToColor } = require("../services/AQINormaliser");
const { findNearestCurrentReading } = require("../services/LocationResolution");

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
  const { reading: row, resolution } = await findNearestCurrentReading({
    lat,
    lng,
    radiusDegrees: degreesRadius
  });

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
    resolution,
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
