import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackForecast,
  createFallbackForecastResponse,
  summariseForecast,
  toForecastChartData
} from "./forecast.ts";

test("buildFallbackForecast returns a full 24-hour forecast with ordered hours", () => {
  const forecast = buildFallbackForecast(52);

  assert.equal(forecast.length, 24);
  assert.equal(forecast[0]?.hour, 1);
  assert.equal(forecast[23]?.hour, 24);
  assert.ok(forecast.every((point) => point.confidence.high > point.confidence.low));
});

test("createFallbackForecastResponse preserves coordinates and model metadata", () => {
  const response = createFallbackForecastResponse({
    baseAqi: 48,
    lat: 52.3676,
    lng: 4.9041
  });

  assert.equal(response.lat, 52.3676);
  assert.equal(response.lng, 4.9041);
  assert.equal(response.modelVersion, "lstm-v1.0.0");
  assert.equal(response.strategy, "preview");
});

test("toForecastChartData derives a confidence band series for recharts", () => {
  const chartData = toForecastChartData([
    {
      hour: 1,
      aqi: 61,
      confidence: {
        low: 54,
        high: 72
      }
    }
  ]);

  assert.deepEqual(chartData, [
    {
      hour: "1h",
      aqi: 61,
      low: 54,
      high: 72,
      bandBase: 54,
      bandSpread: 18
    }
  ]);
});

test("summariseForecast returns the peak hour and average AQI", () => {
  const summary = summariseForecast([
    { hour: 1, aqi: 50, confidence: { low: 44, high: 59 } },
    { hour: 2, aqi: 67, confidence: { low: 58, high: 78 } },
    { hour: 3, aqi: 61, confidence: { low: 53, high: 73 } }
  ]);

  assert.deepEqual(summary, {
    averageAqi: 59,
    peakAqi: 67,
    peakHour: 2
  });
});
