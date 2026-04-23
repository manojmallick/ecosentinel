jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));
jest.mock("../src/services/openaq", () => ({
  getLatestReadings: jest.fn()
}));
jest.mock("../src/services/iqair", () => ({
  getNearestCity: jest.fn()
}));

const pool = require("../src/db/pool");
const { getNearestCity } = require("../src/services/iqair");
const { getLatestReadings } = require("../src/services/openaq");
const { resetLiveResolutionCache } = require("../src/services/LocationResolution");
const { getCurrentAqi } = require("../src/routes/aqi");
const { getHistory } = require("../src/routes/history");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe("REST API route handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLiveResolutionCache();
    getLatestReadings.mockResolvedValue([]);
    getNearestCity.mockResolvedValue(null);
  });

  it("returns the nearest current AQI reading", async () => {
    const recordedAt = new Date().toISOString();

    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lat: 52.3676,
          lng: 4.9041,
          aqi: 48,
          category: "Good",
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3,
          source: "openaq",
          recorded_at: recordedAt
        }
      ]
    });

    const response = createResponse();

    await getCurrentAqi(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041,
          radius_km: 5
        }
      },
      response
    );

    expect(response.json).toHaveBeenCalledWith({
      lat: 52.3676,
      lng: 4.9041,
      aqi: 48,
      category: "Good",
      color: "#00e400",
      pollutants: {
        pm25: 10.2,
        pm10: 18.5,
        no2: 22.1,
        o3: 55.3
      },
      freshness: "current",
      resolution: "local",
      source: "openaq",
      timestamp: recordedAt
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM aqi_readings"), [
      52.3676,
      4.9041,
      expect.any(Number)
    ]);
    expect(pool.query.mock.calls[0][0]).toContain("$1::double precision - $3::double precision");
    expect(pool.query.mock.calls[0][0]).toContain("POWER(lat - $1::double precision, 2)");
  });

  it("uses a live requested-location provider reading when stored data is missing", async () => {
    const recordedAt = new Date().toISOString();

    pool.query
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: []
      });

    getLatestReadings.mockResolvedValueOnce([
      {
        coordinates: {
          latitude: 52.3437,
          longitude: 4.8107
        },
        sensors: [
          {
            parameter: {
              name: "pm25"
            },
            latest: {
              value: 13.2,
              datetime: {
                utc: recordedAt
              }
            }
          },
          {
            parameter: {
              name: "o3"
            },
            latest: {
              value: 50.1,
              datetime: {
                utc: recordedAt
              }
            }
          }
        ]
      }
    ]);

    const response = createResponse();

    await getCurrentAqi(
      {
        query: {
          lat: 52.34368048931782,
          lng: 4.8106501535156125,
          radius_km: 5
        }
      },
      response
    );

    expect(response.json).toHaveBeenCalledWith({
      lat: 52.3437,
      lng: 4.8107,
      aqi: expect.any(Number),
      category: expect.any(String),
      color: expect.any(String),
      pollutants: {
        pm25: 13.2,
        pm10: null,
        no2: null,
        o3: 50.1
      },
      freshness: "live_provider",
      resolution: "requested_location",
      source: "openaq",
      timestamp: recordedAt
    });
    expect(getLatestReadings).toHaveBeenCalledWith(52.34368048931782, 4.8106501535156125, 10);
    expect(pool.query.mock.calls[2][0]).toContain("INSERT INTO aqi_readings");
  });

  it("falls back to the nearest available AQI reading when no local point exists", async () => {
    const recordedAt = new Date().toISOString();

    pool.query
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [
          {
            lat: 52.3676,
            lng: 4.9041,
            aqi: 52,
            category: "Moderate",
            pm25: 11.2,
            pm10: 19.5,
            no2: 23.1,
            o3: 56.3,
            source: "openaq",
            recorded_at: recordedAt
          }
        ]
      });

    const response = createResponse();

    await getCurrentAqi(
      {
        query: {
          lat: 52.34368048931782,
          lng: 4.8106501535156125,
          radius_km: 5
        }
      },
      response
    );

    expect(response.json).toHaveBeenCalledWith({
      lat: 52.3676,
      lng: 4.9041,
      aqi: 52,
      category: "Moderate",
      color: "#ffff00",
      pollutants: {
        pm25: 11.2,
        pm10: 19.5,
        no2: 23.1,
        o3: 56.3
      },
      freshness: "current",
      resolution: "nearest_available",
      source: "openaq",
      timestamp: recordedAt
    });
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query.mock.calls[1][0]).toContain("ORDER BY POWER(lat - $1::double precision, 2)");
  });

  it("caches provider failures for a while instead of retrying every request", async () => {
    const recordedAt = new Date().toISOString();

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            lat: 52.3676,
            lng: 4.9041,
            aqi: 52,
            category: "Moderate",
            pm25: 11.2,
            pm10: 19.5,
            no2: 23.1,
            o3: 56.3,
            source: "openaq",
            recorded_at: recordedAt
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            lat: 52.3676,
            lng: 4.9041,
            aqi: 52,
            category: "Moderate",
            pm25: 11.2,
            pm10: 19.5,
            no2: 23.1,
            o3: 56.3,
            source: "openaq",
            recorded_at: recordedAt
          }
        ]
      });

    const response = createResponse();
    const request = {
      query: {
        lat: 52.34368048931782,
        lng: 4.8106501535156125,
        radius_km: 5
      }
    };

    await getCurrentAqi(request, response);
    await getCurrentAqi(request, response);

    expect(getLatestReadings).toHaveBeenCalledTimes(1);
    expect(getNearestCity).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  it("rejects invalid AQI query parameters", async () => {
    const response = createResponse();

    await getCurrentAqi(
      {
        query: {
          lat: "bad",
          lng: 4.9
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "lat, lng, and radius_km must be valid numbers"
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("returns historical readings for the requested window", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          timestamp: "2026-04-18T13:00:00Z",
          aqi: 45,
          pm25: 9.8,
          pm10: 17.1,
          no2: 20.2,
          o3: 49.5,
          source: "openaq"
        }
      ]
    });

    const response = createResponse();

    await getHistory(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041,
          hours: 24
        }
      },
      response
    );

    expect(response.json).toHaveBeenCalledWith([
      {
        timestamp: "2026-04-18T13:00:00Z",
        aqi: 45,
        pm25: 9.8,
        pm10: 17.1,
        no2: 20.2,
        o3: 49.5,
        source: "openaq"
      }
    ]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("recorded_at >= NOW()"), [
      52.3676,
      4.9041,
      "24"
    ]);
    expect(pool.query.mock.calls[0][0]).toContain("$1::double precision - 0.05");
  });

  it("rejects invalid history query parameters", async () => {
    const response = createResponse();

    await getHistory(
      {
        query: {
          lat: 52.3676,
          lng: 4.9041,
          hours: "zero"
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "lat, lng, and hours must be valid numbers"
    });
  });
});
