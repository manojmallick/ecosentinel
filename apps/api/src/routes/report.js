const express = require("express");

const { generateForecast } = require("../agents/PredictionAgent");
const pool = require("../db/pool");
const { findNearestHistoryAnchor, resolveCurrentReading } = require("../services/LocationResolution");
const { buildPolicyReportData, renderPolicyReportPdf } = require("../services/policyReport");

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

async function fetchCurrentReading({ lat, lng, db = pool }) {
  const result = await resolveCurrentReading({
    lat,
    lng,
    radiusDegrees: 5 / 111,
    db
  });
  const row = result.reading;

  if (!row) {
    return null;
  }

  return {
    lat: row.lat,
    lng: row.lng,
    aqi: Number(row.aqi),
    category: row.category,
    pollutants: {
      pm25: row.pm25,
      pm10: row.pm10,
      no2: row.no2,
      o3: row.o3
    },
    freshness: result.freshness,
    resolution: result.resolution,
    source: row.source,
    timestamp: row.recorded_at
  };
}

async function fetchHistory({ hours, lat, lng, db = pool }) {
  const query = `
    SELECT recorded_at AS timestamp, aqi, pm25, pm10, no2, o3, source
    FROM aqi_readings
    WHERE lat BETWEEN $1::double precision - 0.05 AND $1::double precision + 0.05
      AND lng BETWEEN $2::double precision - 0.05 AND $2::double precision + 0.05
      AND recorded_at >= NOW() - ($3::text || ' hours')::interval
    ORDER BY recorded_at ASC
  `;

  const result = await db.query(query, [lat, lng, String(hours)]);
  if (result.rows.length > 0) {
    return result.rows;
  }

  const anchor = await findNearestHistoryAnchor({
    lat,
    lng,
    db
  });

  if (!anchor) {
    return [];
  }

  const nearestResult = await db.query(query, [anchor.lat, anchor.lng, String(hours)]);
  return nearestResult.rows;
}

async function getPolicyReport(req, res) {
  const lat = parseCoordinate(req.query.lat, 52.3676);
  const lng = parseCoordinate(req.query.lng, 4.9041);
  const hours = parseHours(req.query.hours);

  if (lat == null || lng == null || hours == null) {
    return res.status(400).json({
      error: "lat, lng, and hours must be valid numbers"
    });
  }

  const currentReading = await fetchCurrentReading({
    lat,
    lng
  });

  if (!currentReading) {
    return res.status(404).json({
      error: "No AQI readings found for the requested location"
    });
  }

  const history = await fetchHistory({
    lat,
    lng,
    hours
  });

  let forecast = null;
  try {
    forecast = await generateForecast({
      lat,
      lng,
      signOutput: false
    });
  } catch (_error) {
    forecast = null;
  }

  const reportData = buildPolicyReportData({
    currentReading,
    forecast,
    history,
    hours,
    lat,
    lng
  });

  const pdfBuffer = await renderPolicyReportPdf(reportData);
  const filename = `ecosentinel-policy-report-${lat.toFixed(4)}-${lng.toFixed(4)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

  return res.send(pdfBuffer);
}

router.get("/", (req, res, next) => {
  getPolicyReport(req, res).catch(next);
});

module.exports = {
  fetchCurrentReading,
  fetchHistory,
  getPolicyReport,
  router
};
