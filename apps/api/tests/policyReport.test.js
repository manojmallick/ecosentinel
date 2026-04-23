jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));

jest.mock("../src/agents/PredictionAgent", () => ({
  generateForecast: jest.fn()
}));
jest.mock("../src/services/openaq", () => ({
  getLatestReadings: jest.fn()
}));
jest.mock("../src/services/openMeteo", () => ({
  getCurrentAirQuality: jest.fn()
}));

const pool = require("../src/db/pool");
const { generateForecast } = require("../src/agents/PredictionAgent");
const { getCurrentAirQuality } = require("../src/services/openMeteo");
const { getLatestReadings } = require("../src/services/openaq");
const { getPolicyReport } = require("../src/routes/report");
const {
  buildPolicyReportData,
  renderPolicyReportPdf
} = require("../src/services/policyReport");

function createResponse() {
  return {
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis()
  };
}

function createCurrentReading(overrides = {}) {
  return {
    lat: 52.3676,
    lng: 4.9041,
    aqi: 88,
    category: "Moderate",
    pollutants: {
      pm25: 22,
      pm10: 31,
      no2: 27,
      o3: 64
    },
    source: "openaq",
    timestamp: "2026-04-23T09:00:00.000Z",
    ...overrides
  };
}

describe("policy report generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-04-23T09:30:00.000Z"));
    getCurrentAirQuality.mockResolvedValue(null);
    getLatestReadings.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds a policy report payload with history and forecast summaries", () => {
    const report = buildPolicyReportData({
      currentReading: createCurrentReading(),
      history: [
        { timestamp: "2026-04-23T06:00:00.000Z", aqi: 61 },
        { timestamp: "2026-04-23T07:00:00.000Z", aqi: 72 },
        { timestamp: "2026-04-23T08:00:00.000Z", aqi: 79 }
      ],
      forecast: {
        forecast: [
          { hour: 1, aqi: 90, confidence: { low: 81, high: 98 } },
          { hour: 2, aqi: 104, confidence: { low: 94, high: 115 } }
        ],
        generatedAt: "2026-04-23T09:00:00.000Z",
        historyResolution: "local",
        modelVersion: "lstm-v1.0.0",
        strategy: "fallback"
      },
      generatedAt: "2026-04-23T09:30:00.000Z",
      hours: 24,
      lat: 52.3676,
      lng: 4.9041
    });

    expect(report.historySummary).toEqual({
      averageAqi: 71,
      maxAqi: 79,
      minAqi: 61,
      sampleCount: 3,
      trendLabel: "Worsening"
    });
    expect(report.forecastSummary).toEqual({
      averageAqi: 97,
      historyResolution: "local",
      peakAqi: 104,
      peakHour: 2,
      strategy: "fallback",
      modelVersion: "lstm-v1.0.0"
    });
    expect(report.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("public-health messaging"),
        expect.stringContaining("mitigation messaging")
      ])
    );
  });

  it("renders a PDF buffer that starts with a PDF header", async () => {
    const pdf = await renderPolicyReportPdf(
      buildPolicyReportData({
        currentReading: createCurrentReading(),
        history: [{ timestamp: "2026-04-23T08:00:00.000Z", aqi: 81 }],
        forecast: null,
        hours: 24,
        lat: 52.3676,
        lng: 4.9041
      })
    );

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("returns a PDF response for the requested location", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            lat: 52.3676,
            lng: 4.9041,
            aqi: 88,
            category: "Moderate",
            pm25: 22,
            pm10: 31,
            no2: 27,
            o3: 64,
            source: "openaq",
            recorded_at: "2026-04-23T09:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          { timestamp: "2026-04-23T07:00:00.000Z", aqi: 72 },
          { timestamp: "2026-04-23T08:00:00.000Z", aqi: 81 }
        ]
      });

    generateForecast.mockResolvedValueOnce({
      forecast: [
        { hour: 1, aqi: 92, confidence: { low: 84, high: 101 } },
        { hour: 2, aqi: 98, confidence: { low: 89, high: 108 } }
      ],
      generatedAt: "2026-04-23T09:00:00.000Z",
      modelVersion: "lstm-v1.0.0",
      strategy: "fallback"
    });

    const response = createResponse();

    await getPolicyReport(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041,
          hours: 24
        }
      },
      response
    );

    expect(generateForecast).toHaveBeenCalledWith({
      lat: 52.3676,
      lng: 4.9041,
      signOutput: false
    });
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("ecosentinel-policy-report-52.3676-4.9041.pdf")
    );
    expect(response.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("rejects invalid report query parameters", async () => {
    const response = createResponse();

    await getPolicyReport(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041,
          hours: "bad"
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "lat, lng, and hours must be valid numbers"
    });
  });

  it("returns 404 when there is no current AQI reading for the location", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: []
      });

    const response = createResponse();

    await getPolicyReport(
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
      error: "No AQI readings found for the requested location"
    });
  });

  it("still generates a report when the forecast service is unavailable", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            lat: 52.3676,
            lng: 4.9041,
            aqi: 88,
            category: "Moderate",
            pm25: 22,
            pm10: 31,
            no2: 27,
            o3: 64,
            source: "openaq",
            recorded_at: "2026-04-23T09:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ timestamp: "2026-04-23T08:00:00.000Z", aqi: 81 }]
      });

    generateForecast.mockRejectedValueOnce(new Error("prediction unavailable"));

    const response = createResponse();

    await getPolicyReport(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041,
          hours: 24
        }
      },
      response
    );

    expect(response.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
