jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));

const path = require("path");

const pool = require("../src/db/pool");
const {
  buildInputWindow,
  createFallbackForecast,
  forecastFromReadings,
  generateForecast,
  getPredictionConfig,
  normaliseHistory,
  resolveModelPath,
  shapeModelForecast
} = require("../src/agents/PredictionAgent");

function buildHistory(length, startAqi = 40) {
  return Array.from({ length }, (_, index) => ({
    recorded_at: new Date(Date.UTC(2026, 3, 18, index, 0, 0)).toISOString(),
    aqi: startAqi + index
  }));
}

describe("PredictionAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalises and sorts database history ascending by timestamp", () => {
    const history = normaliseHistory([
      { recorded_at: "2026-04-18T02:00:00.000Z", aqi: "44" },
      { recorded_at: "2026-04-18T00:00:00.000Z", aqi: "41" }
    ]);

    expect(history).toEqual([
      { timestamp: "2026-04-18T00:00:00.000Z", aqi: 41 },
      { timestamp: "2026-04-18T02:00:00.000Z", aqi: 44 }
    ]);
  });

  it("pads the model input window when history is shorter than the configured input length", () => {
    const windowValues = buildInputWindow(
      [
        { timestamp: "2026-04-18T00:00:00.000Z", aqi: 42 },
        { timestamp: "2026-04-18T01:00:00.000Z", aqi: 45 }
      ],
      5
    );

    expect(windowValues).toEqual([42, 42, 42, 42, 45]);
  });

  it("resolves the default TFJS model path to the repo-level ml directory", () => {
    const resolvedPath = resolveModelPath(getPredictionConfig().modelPath);

    expect(resolvedPath).toBe(
      path.resolve(__dirname, "../../ml/model/tfjs/model.json")
    );
  });

  it("creates a 24-hour fallback forecast with confidence bands", () => {
    const forecast = createFallbackForecast(
      buildHistory(12).map((row) => ({ timestamp: row.recorded_at, aqi: row.aqi })),
      24
    );

    expect(forecast).toHaveLength(24);
    expect(forecast[0]).toEqual({
      hour: 1,
      aqi: expect.any(Number),
      confidence: {
        low: expect.any(Number),
        high: expect.any(Number)
      }
    });
    expect(forecast[0].confidence.high).toBeGreaterThan(forecast[0].confidence.low);
  });

  it("uses the model predictions when a prediction adapter is supplied", async () => {
    const history = buildHistory(48).map((row) => ({ timestamp: row.recorded_at, aqi: row.aqi }));
    const model = {
      predict: jest.fn(async () => Array.from({ length: 24 }, (_, index) => 60 + index))
    };

    const result = await forecastFromReadings(history, {
      inputHours: 48,
      outputHours: 24,
      model
    });

    expect(result.strategy).toBe("lstm");
    expect(model.predict).toHaveBeenCalledWith(expect.any(Array));
    expect(result.forecast).toHaveLength(24);
    expect(result.forecast[0].aqi).toBe(60);
    expect(result.forecast[23].aqi).toBe(83);
  });

  it("shapes model predictions to the required forecast contract", () => {
    const forecast = shapeModelForecast(
      [51.2, 52.7],
      buildHistory(6).map((row) => ({ timestamp: row.recorded_at, aqi: row.aqi })),
      4
    );

    expect(forecast).toEqual([
      { hour: 1, aqi: 51, confidence: { low: expect.any(Number), high: expect.any(Number) } },
      { hour: 2, aqi: 53, confidence: { low: expect.any(Number), high: expect.any(Number) } },
      { hour: 3, aqi: 53, confidence: { low: expect.any(Number), high: expect.any(Number) } },
      { hour: 4, aqi: 53, confidence: { low: expect.any(Number), high: expect.any(Number) } }
    ]);
  });

  it("queries recent AQI history and returns a full forecast payload", async () => {
    pool.query.mockResolvedValueOnce({
      rows: buildHistory(24)
    });

    const forecast = await generateForecast({
      lat: 52.3676,
      lng: 4.9041,
      now: new Date("2026-04-22T08:00:00.000Z"),
      model: null,
      config: {
        inputHours: 24,
        outputHours: 24,
        modelPath: "../../ml/model/tfjs/model.json",
        modelVersion: "lstm-v1.0.0"
      },
      signOutput: false
    });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM aqi_readings"), [52.3676, 4.9041, 24]);
    expect(forecast).toEqual({
      lat: 52.3676,
      lng: 4.9041,
      generatedAt: "2026-04-22T08:00:00.000Z",
      modelVersion: "lstm-v1.0.0",
      strategy: "fallback",
      sourceWindowHours: 24,
      forecast: expect.any(Array)
    });
    expect(forecast.forecast).toHaveLength(24);
  });

  it("throws when no AQI history is available", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      generateForecast({
        lat: 52.3676,
        lng: 4.9041,
        model: null,
        signOutput: false
      })
    ).rejects.toThrow("Not enough AQI history to generate a forecast");
  });

  it("signs prediction output when signing is enabled", async () => {
    pool.query.mockResolvedValueOnce({
      rows: buildHistory(24)
    });

    const auditLogger = {
      signPredictionOutput: jest.fn(async (forecast) => ({
        ...forecast,
        signature: "signed",
        publicKey: "public"
      }))
    };

    const forecast = await generateForecast({
      lat: 52.3676,
      lng: 4.9041,
      model: null,
      signOutput: true,
      auditLogger,
      config: {
        inputHours: 24,
        outputHours: 24,
        modelPath: "../../ml/model/tfjs/model.json",
        modelVersion: "lstm-v1.0.0"
      }
    });

    expect(auditLogger.signPredictionOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 52.3676,
        lng: 4.9041,
        modelVersion: "lstm-v1.0.0",
        forecast: expect.any(Array)
      }),
      { db: pool }
    );
    expect(forecast.signature).toBe("signed");
    expect(forecast.publicKey).toBe("public");
  });
});
