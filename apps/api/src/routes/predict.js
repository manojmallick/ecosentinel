const express = require("express");

const { generateForecast } = require("../agents/PredictionAgent");

const router = express.Router();

function parseCoordinate(value, fallback) {
  const parsed = Number.parseFloat(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getPrediction(req, res) {
  const lat = parseCoordinate(req.query.lat, 52.3676);
  const lng = parseCoordinate(req.query.lng, 4.9041);

  if (lat == null || lng == null) {
    return res.status(400).json({
      error: "lat and lng must be valid numbers"
    });
  }

  try {
    const forecast = await generateForecast({
      lat,
      lng
    });

    return res.json(forecast);
  } catch (error) {
    if (error.message === "Not enough AQI history to generate a forecast") {
      return res.status(404).json({
        error: "No AQI history available for the requested location"
      });
    }

    throw error;
  }
}

router.get("/", (req, res, next) => {
  getPrediction(req, res).catch(next);
});

module.exports = {
  getPrediction,
  router
};
