import test from "node:test";
import assert from "node:assert/strict";

import { evaluateDriftAlert, getDriftThreshold } from "./drift.ts";
import type { AqiReading } from "./api";
import type { ForecastResponse } from "./forecast";

function createReading(aqi: number): AqiReading {
  return {
    aqi,
    category: aqi >= 101 ? "USG" : aqi >= 51 ? "Moderate" : "Good",
    color: "#f97316",
    lat: 52.3676,
    lng: 4.9041,
    pointName: "Amsterdam Centre",
    pollutants: {
      no2: 24,
      o3: 53,
      pm10: 19,
      pm25: 12
    },
    source: "openaq",
    timestamp: "2026-04-23T09:00:00.000Z"
  };
}

function createForecast(firstHourAqi: number): ForecastResponse {
  return {
    forecast: [
      {
        hour: 1,
        aqi: firstHourAqi,
        confidence: {
          low: Math.max(0, firstHourAqi - 8),
          high: firstHourAqi + 8
        }
      }
    ],
    generatedAt: "2026-04-23T08:00:00.000Z",
    lat: 52.3676,
    lng: 4.9041,
    modelVersion: "lstm-v1.0.0",
    strategy: "live"
  };
}

test("getDriftThreshold falls back to 20 when no env var is provided", () => {
  assert.equal(getDriftThreshold(), 20);
});

test("evaluateDriftAlert stays stable when actual AQI is within threshold", () => {
  const alert = evaluateDriftAlert({
    reading: createReading(72),
    forecast: createForecast(58),
    threshold: 20
  });

  assert.equal(alert.shouldAlert, false);
  assert.equal(alert.severity, "stable");
  assert.equal(alert.delta, 14);
  assert.match(alert.summary, /No active drift alert/i);
});

test("evaluateDriftAlert raises a warning when actual AQI exceeds forecast by 20 points", () => {
  const alert = evaluateDriftAlert({
    reading: createReading(84),
    forecast: createForecast(60),
    threshold: 20
  });

  assert.equal(alert.shouldAlert, true);
  assert.equal(alert.severity, "warning");
  assert.equal(alert.delta, 24);
  assert.match(alert.summary, /Conditions are degrading faster than the model expected/i);
});

test("evaluateDriftAlert escalates to critical when the forecast miss is much larger than threshold", () => {
  const alert = evaluateDriftAlert({
    reading: createReading(105),
    forecast: createForecast(62),
    threshold: 20
  });

  assert.equal(alert.shouldAlert, true);
  assert.equal(alert.severity, "critical");
  assert.equal(alert.delta, 43);
});
