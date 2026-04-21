const {
  calculateAQI,
  aqiToCategory,
  calculateFromPollutants
} = require("../src/services/AQINormaliser");

describe("AQINormaliser", () => {
  test("PM2.5 = 0 ug/m3 returns AQI 0", () => {
    expect(calculateAQI(0, "pm25")).toBe(0);
  });

  test("PM2.5 = 12.0 ug/m3 returns AQI 50", () => {
    expect(calculateAQI(12.0, "pm25")).toBe(50);
  });

  test("PM2.5 = 35.4 ug/m3 returns AQI 100", () => {
    expect(calculateAQI(35.4, "pm25")).toBe(100);
  });

  test("AQI 50 maps to Good", () => {
    expect(aqiToCategory(50)).toBe("Good");
  });

  test("AQI 101 maps to USG", () => {
    expect(aqiToCategory(101)).toBe("USG");
  });

  test("calculateFromPollutants uses the maximum pollutant AQI", () => {
    const result = calculateFromPollutants({
      pm25: 5,
      pm10: 40,
      no2: 200,
      o3: 30
    });

    expect(result.aqi).toBeGreaterThan(100);
    expect(result.category).toBe("USG");
  });

  test("calculateFromPollutants tolerates null pollutant values", () => {
    expect(() =>
      calculateFromPollutants({
        pm25: 10,
        pm10: null,
        no2: null,
        o3: null
      })
    ).not.toThrow();
  });

  test("PM2.5 = 55.5 ug/m3 returns AQI 151 at the unhealthy boundary", () => {
    expect(calculateAQI(55.5, "pm25")).toBe(151);
  });
});
