import type { AqiReading } from "./api";
import type { ForecastResponse } from "./forecast";

export type DriftAlertState = {
  currentAqi: number;
  delta: number;
  expectedAqi: number;
  severity: "critical" | "stable" | "warning";
  shouldAlert: boolean;
  summary: string;
  threshold: number;
};

export function getDriftThreshold() {
  const configuredThreshold = Number.parseInt(
    process.env.NEXT_PUBLIC_DRIFT_ALERT_THRESHOLD ?? "20",
    10
  );

  return Number.isFinite(configuredThreshold) && configuredThreshold > 0
    ? configuredThreshold
    : 20;
}

export function evaluateDriftAlert({
  forecast,
  reading,
  threshold = getDriftThreshold()
}: {
  forecast: ForecastResponse;
  reading: AqiReading;
  threshold?: number;
}): DriftAlertState {
  const expectedPoint = forecast.forecast[0];

  if (!expectedPoint) {
    return {
      currentAqi: reading.aqi,
      delta: 0,
      expectedAqi: reading.aqi,
      severity: "stable",
      shouldAlert: false,
      summary: "No forecast point is available yet for drift monitoring.",
      threshold
    };
  }

  const delta = reading.aqi - expectedPoint.aqi;
  const shouldAlert = delta >= threshold;
  const severity = shouldAlert && delta >= threshold * 1.75 ? "critical" : shouldAlert ? "warning" : "stable";

  if (shouldAlert) {
    return {
      currentAqi: reading.aqi,
      delta,
      expectedAqi: expectedPoint.aqi,
      severity,
      shouldAlert,
      summary: `Actual AQI is ${delta} points above the next-hour forecast. Conditions are degrading faster than the model expected.`,
      threshold
    };
  }

  const remainingHeadroom = threshold - delta;

  return {
    currentAqi: reading.aqi,
    delta,
    expectedAqi: expectedPoint.aqi,
    severity,
    shouldAlert,
    summary:
      delta >= 0
        ? `No active drift alert. Actual AQI is ${delta} points above forecast, leaving ${remainingHeadroom} AQI points before the alert threshold.`
        : `No active drift alert. Actual AQI is ${Math.abs(delta)} points below forecast, so the current reading is tracking better than expected.`,
    threshold
  };
}
