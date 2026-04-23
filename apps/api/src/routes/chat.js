const express = require("express");

const { answerCitizenQuestion } = require("../agents/CitizenAdvisorAgent");

const router = express.Router();

function parseCoordinate(value, fallback) {
  const parsed = Number.parseFloat(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : null;
}

async function postChat(req, res) {
  const { message } = req.body ?? {};
  const lat = parseCoordinate(req.body?.lat, 52.3676);
  const lng = parseCoordinate(req.body?.lng, 4.9041);

  if (!message || !String(message).trim()) {
    return res.status(400).json({
      error: "message is required"
    });
  }

  if (lat == null || lng == null) {
    return res.status(400).json({
      error: "lat and lng must be valid numbers"
    });
  }

  try {
    const answer = await answerCitizenQuestion({
      message: String(message),
      lat,
      lng
    });

    return res.json(answer);
  } catch (error) {
    if (
      error.message === "No AQI reading available for advisor context" ||
      error.message === "Not enough AQI history to generate a forecast"
    ) {
      return res.status(404).json({
        error: "No AQI context available for the requested location"
      });
    }

    throw error;
  }
}

router.post("/", (req, res, next) => {
  postChat(req, res).catch(next);
});

module.exports = {
  postChat,
  router
};
