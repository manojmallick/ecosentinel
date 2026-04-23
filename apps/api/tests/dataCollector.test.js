jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));

jest.mock("../src/services/openaq", () => ({
  getLatestReadings: jest.fn()
}));

jest.mock("../src/services/openMeteo", () => ({
  getCurrentAirQuality: jest.fn()
}));

jest.mock("../src/services/AQINormaliser", () => ({
  calculateFromPollutants: jest.fn(() => ({
    aqi: 48,
    category: "Good",
    color: "#00e400"
  })),
  aqiToCategory: jest.fn((aqi) => (aqi <= 50 ? "Good" : "Moderate"))
}));

const pool = require("../src/db/pool");
const AQINormaliser = require("../src/services/AQINormaliser");
const { getCurrentAirQuality } = require("../src/services/openMeteo");
const { getLatestReadings } = require("../src/services/openaq");
const {
  buildInsertStatement,
  collect,
  extractPollutants,
  flattenReadings
} = require("../src/agents/DataCollectorAgent");

describe("DataCollectorAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentAirQuality.mockResolvedValue(null);
    getLatestReadings.mockResolvedValue([]);
  });

  it("extracts supported pollutant values from OpenAQ sensors", () => {
    const pollutants = extractPollutants({
      sensors: [
        { parameter: { name: "pm25" }, latest: { value: 11.2 } },
        { parameter: { name: "pm10" }, latest: { value: 19.4 } },
        { parameter: { name: "temperature" }, latest: { value: 14 } },
        { parameter: { name: "o3" }, latest: { value: 61 } }
      ]
    });

    expect(pollutants).toEqual({
      pm25: 11.2,
      pm10: 19.4,
      o3: 61
    });
  });

  it("collects Open-Meteo as the default source and OpenAQ as secondary validation data", async () => {
    getCurrentAirQuality
      .mockResolvedValueOnce({
        lat: 52.3676,
        lng: 4.9041,
        pollutants: {
          pm25: 9.4,
          pm10: 15.6,
          no2: 21.1,
          o3: 48.3,
          co: 180,
          so2: 2.1
        },
        recorded_at: "2026-04-23T12:00:00.000Z"
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    getLatestReadings
      .mockResolvedValueOnce([
        {
          coordinates: {
            latitude: 52.36,
            longitude: 4.91
          },
          sensors: [
            { parameter: { name: "pm25" }, latest: { value: 10.5 } },
            { parameter: { name: "pm10" }, latest: { value: 18.1 } }
          ]
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const insertedCount = await collect();

    expect(insertedCount).toBe(2);
    expect(AQINormaliser.calculateFromPollutants).toHaveBeenCalledWith({
      pm25: 9.4,
      pm10: 15.6,
      no2: 21.1,
      o3: 48.3
    });
    expect(AQINormaliser.calculateFromPollutants).toHaveBeenCalledWith({
      pm25: 10.5,
      pm10: 18.1
    });
    expect(getCurrentAirQuality).toHaveBeenCalledTimes(3);
    expect(pool.query).toHaveBeenCalledTimes(1);

    const [query, values] = pool.query.mock.calls[0];
    expect(query).toContain("INSERT INTO aqi_readings");
    expect(values).toEqual([
      52.3676,
      4.9041,
      48,
      "Good",
      9.4,
      15.6,
      21.1,
      48.3,
      "open-meteo",
      52.36,
      4.91,
      48,
      "Good",
      10.5,
      18.1,
      null,
      null,
      "openaq"
    ]);
  });

  it("skips database writes when no providers return readings", async () => {
    const insertedCount = await collect();

    expect(insertedCount).toBe(0);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("builds a 9-column insert statement and flattens readings correctly", () => {
    const readings = [
      {
        lat: 1,
        lng: 2,
        aqi: 3,
        category: "Good",
        pm25: 4,
        pm10: 5,
        no2: 6,
        o3: 7,
        source: "openaq"
      }
    ];

    expect(buildInsertStatement(readings)).toContain("$9");
    expect(flattenReadings(readings)).toEqual([1, 2, 3, "Good", 4, 5, 6, 7, "openaq"]);
  });
});
