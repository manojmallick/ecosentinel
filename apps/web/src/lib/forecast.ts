export type ForecastPoint = {
  aqi: number;
  confidence: {
    high: number;
    low: number;
  };
  hour: number;
};

export type ForecastResponse = {
  forecast: ForecastPoint[];
  generatedAt: string;
  lat: number;
  lng: number;
  modelVersion: string;
  publicKey?: string;
  signature?: string;
  strategy: string;
};

export type ForecastChartPoint = {
  aqi: number;
  bandBase: number;
  bandSpread: number;
  high: number;
  hour: string;
  low: number;
};

export function buildFallbackForecast(baseAqi: number): ForecastPoint[] {
  return Array.from({ length: 24 }, (_, index) => {
    const hour = index + 1;
    const drift = Math.sin(hour / 3.2) * 5 + Math.cos(hour / 5.1) * 2;
    const aqi = Math.max(0, Math.round(baseAqi + drift + hour * 0.45));
    const margin = Math.max(6, Math.round(7 + hour * 0.6));

    return {
      hour,
      aqi,
      confidence: {
        low: Math.max(0, aqi - margin),
        high: aqi + margin
      }
    };
  });
}

export function createFallbackForecastResponse({
  baseAqi,
  lat,
  lng,
  modelVersion = "lstm-v1.0.0",
  now = new Date("2026-04-22T09:00:00.000Z")
}: {
  baseAqi: number;
  lat: number;
  lng: number;
  modelVersion?: string;
  now?: Date;
}): ForecastResponse {
  return {
    lat,
    lng,
    generatedAt: now.toISOString(),
    modelVersion,
    strategy: "preview",
    forecast: buildFallbackForecast(baseAqi)
  };
}

export function toForecastChartData(points: ForecastPoint[]): ForecastChartPoint[] {
  return points.map((point) => ({
    hour: `${point.hour}h`,
    aqi: point.aqi,
    low: point.confidence.low,
    high: point.confidence.high,
    bandBase: point.confidence.low,
    bandSpread: point.confidence.high - point.confidence.low
  }));
}

export function summariseForecast(points: ForecastPoint[]) {
  const worstPoint = points.reduce((current, point) => {
    return point.aqi > current.aqi ? point : current;
  }, points[0]);

  const averageAqi = Math.round(points.reduce((sum, point) => sum + point.aqi, 0) / points.length);

  return {
    averageAqi,
    peakAqi: worstPoint.aqi,
    peakHour: worstPoint.hour
  };
}
