"use client";

import { useEffect, useRef, useState } from "react";

import { getAqiBand } from "./aqiColors";
import { createFallbackForecastResponse } from "./forecast";
import type { ForecastResponse } from "./forecast";

export type AqiReading = {
  aqi: number;
  category: string;
  color: string;
  lat: number;
  lng: number;
  pointName: string;
  pollutants: {
    no2: number | null;
    o3: number | null;
    pm10: number | null;
    pm25: number | null;
  };
  source: string;
  timestamp: string;
};

type CollectionPoint = {
  fallbackAqi: number;
  lat: number;
  lng: number;
  pointName: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
const POLL_INTERVAL_MS = 60_000;

const COLLECTION_POINTS: CollectionPoint[] = [
  { pointName: "Amsterdam Centre", lat: 52.3676, lng: 4.9041, fallbackAqi: 48 },
  { pointName: "Amsterdam South", lat: 52.3402, lng: 4.8952, fallbackAqi: 56 },
  { pointName: "Amsterdam North", lat: 52.3792, lng: 4.9007, fallbackAqi: 62 }
];

function buildFallbackReading(point: CollectionPoint): AqiReading {
  const band = getAqiBand(point.fallbackAqi);

  return {
    lat: point.lat,
    lng: point.lng,
    aqi: point.fallbackAqi,
    category: band.label,
    color: band.color,
    pointName: point.pointName,
    pollutants: {
      pm25: point.fallbackAqi / 4.4,
      pm10: point.fallbackAqi / 2.6,
      no2: point.fallbackAqi / 2,
      o3: point.fallbackAqi
    },
    source: "simulated",
    timestamp: new Date("2026-04-22T07:00:00.000Z").toISOString()
  };
}

async function fetchReading(point: CollectionPoint): Promise<AqiReading> {
  const response = await fetch(
    `${API_BASE_URL}/api/aqi?lat=${point.lat}&lng=${point.lng}&radius_km=5`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`AQI fetch failed with ${response.status}`);
  }

  const payload = (await response.json()) as Omit<AqiReading, "pointName">;

  return {
    ...payload,
    pointName: point.pointName
  };
}

async function fetchForecast(lat: number, lng: number): Promise<ForecastResponse> {
  const response = await fetch(`${API_BASE_URL}/api/predict?lat=${lat}&lng=${lng}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Forecast fetch failed with ${response.status}`);
  }

  return (await response.json()) as ForecastResponse;
}

export function useAqiReadings() {
  const [readings, setReadings] = useState<AqiReading[]>(COLLECTION_POINTS.map(buildFallbackReading));
  const [status, setStatus] = useState<"idle" | "live" | "fallback">("idle");
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function refreshReadings() {
      try {
        const liveReadings = await Promise.all(COLLECTION_POINTS.map(fetchReading));

        if (!isMounted.current) {
          return;
        }

        setReadings(liveReadings);
        setStatus("live");
        setLastUpdated(new Date().toISOString());
      } catch (_error) {
        if (!isMounted.current) {
          return;
        }

        setReadings(COLLECTION_POINTS.map(buildFallbackReading));
        setStatus("fallback");
        setLastUpdated(new Date().toISOString());
      }
    }

    void refreshReadings();
    const interval = window.setInterval(() => {
      void refreshReadings();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return {
    lastUpdated,
    readings,
    status
  };
}

export function useForecast(baseReading?: AqiReading) {
  const fallback = createFallbackForecastResponse({
    baseAqi: baseReading?.aqi ?? 54,
    lat: baseReading?.lat ?? 52.3676,
    lng: baseReading?.lng ?? 4.9041
  });

  const [forecast, setForecast] = useState<ForecastResponse>(fallback);
  const [status, setStatus] = useState<"idle" | "live" | "preview">("idle");
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!baseReading) {
      return;
    }

    const reading = baseReading;

    async function refreshForecast() {
      try {
        const liveForecast = await fetchForecast(reading.lat, reading.lng);

        if (!isMounted.current) {
          return;
        }

        setForecast(liveForecast);
        setStatus("live");
      } catch (_error) {
        if (!isMounted.current) {
          return;
        }

        setForecast(
          createFallbackForecastResponse({
            baseAqi: reading.aqi,
            lat: reading.lat,
            lng: reading.lng
          })
        );
        setStatus("preview");
      }
    }

    void refreshForecast();
  }, [baseReading]);

  return {
    forecast,
    status
  };
}
