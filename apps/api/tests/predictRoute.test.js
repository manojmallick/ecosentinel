jest.mock("../src/agents/PredictionAgent", () => ({
  generateForecast: jest.fn()
}));

const { generateForecast } = require("../src/agents/PredictionAgent");
const app = require("../src/app");
const { getPrediction } = require("../src/routes/predict");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

function buildForecastPayload() {
  return {
    lat: 52.3676,
    lng: 4.9041,
    generatedAt: "2026-04-23T00:45:00.000Z",
    modelVersion: "lstm-v1.0.0",
    strategy: "fallback",
    sourceWindowHours: 24,
    forecast: [
      {
        hour: 1,
        aqi: 50,
        confidence: {
          low: 42,
          high: 58
        }
      }
    ]
  };
}

describe("prediction route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mounts the prediction router in the Express app", () => {
    const mountedRouters = app._router.stack
      .filter((layer) => layer.name === "router")
      .map((layer) => layer.regexp.toString());

    expect(mountedRouters.some((route) => route.includes("\\/api\\/predict"))).toBe(true);
  });

  it("serves /api/predict with a forecast payload", async () => {
    const forecast = buildForecastPayload();
    generateForecast.mockResolvedValueOnce(forecast);
    const response = createResponse();

    await getPrediction(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041
        }
      },
      response
    );

    expect(generateForecast).toHaveBeenCalledWith({
        lat: 52.3676,
        lng: 4.9041
    });
    expect(response.json).toHaveBeenCalledWith(forecast);
  });

  it("rejects invalid prediction coordinates", async () => {
    const response = createResponse();

    await getPrediction(
      {
        query: {
          lat: "bad",
          lng: 4.9041
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "lat and lng must be valid numbers"
    });
    expect(generateForecast).not.toHaveBeenCalled();
  });

  it("returns a clear 404 when no AQI history exists", async () => {
    generateForecast.mockRejectedValueOnce(new Error("Not enough AQI history to generate a forecast"));
    const response = createResponse();

    await getPrediction(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: "No AQI history available for the requested location"
    });
  });
});
