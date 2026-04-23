jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));

const pool = require("../src/db/pool");
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
  });

  it("returns the nearest current AQI reading", async () => {
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
          recorded_at: "2026-04-18T14:00:00Z"
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
      source: "openaq",
      timestamp: "2026-04-18T14:00:00Z"
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM aqi_readings"), [
      52.3676,
      4.9041,
      expect.any(Number)
    ]);
    expect(pool.query.mock.calls[0][0]).toContain("$1::double precision - $3::double precision");
    expect(pool.query.mock.calls[0][0]).toContain("POWER(lat - $1::double precision, 2)");
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
