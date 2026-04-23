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
const DEFAULT_LAT = Number.parseFloat(process.env.NEXT_PUBLIC_MAP_LAT ?? "52.3676");
const DEFAULT_LNG = Number.parseFloat(process.env.NEXT_PUBLIC_MAP_LNG ?? "4.9041");
const GEOLOCATION_TIMEOUT_MS = 10_000;
const GEOLOCATION_MAX_AGE_MS = 5 * 60_000;
const DEFAULT_CENTER = {
  lat: Number.isFinite(DEFAULT_LAT) ? DEFAULT_LAT : 52.3676,
  lng: Number.isFinite(DEFAULT_LNG) ? DEFAULT_LNG : 4.9041
};

function createCollectionPoints(center: { lat: number; lng: number }): CollectionPoint[] {
  const latOffset = 0.03;
  const lngOffset = 0.04 / Math.max(Math.cos((center.lat * Math.PI) / 180), 0.35);

  return [
    { pointName: "Your location", lat: center.lat, lng: center.lng, fallbackAqi: 48 },
    { pointName: "Nearby north", lat: center.lat + latOffset, lng: center.lng, fallbackAqi: 56 },
    { pointName: "Nearby south-east", lat: center.lat - latOffset * 0.9, lng: center.lng + lngOffset, fallbackAqi: 62 }
  ];
}

function buildFallbackReadings(points: CollectionPoint[]) {
  return points.map(buildFallbackReading);
}

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
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>(() => createCollectionPoints(DEFAULT_CENTER));
  const [readings, setReadings] = useState<AqiReading[]>(() => buildFallbackReadings(createCollectionPoints(DEFAULT_CENTER)));
  const [locationStatus, setLocationStatus] = useState<"fallback" | "granted" | "locating">("locating");
  const [status, setStatus] = useState<"idle" | "live" | "fallback">("idle");
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("fallback");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMounted.current) {
          return;
        }

        setCollectionPoints(
          createCollectionPoints({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        );
        setLocationStatus("granted");
      },
      () => {
        if (!isMounted.current) {
          return;
        }

        setLocationStatus("fallback");
      },
      {
        enableHighAccuracy: false,
        maximumAge: GEOLOCATION_MAX_AGE_MS,
        timeout: GEOLOCATION_TIMEOUT_MS
      }
    );
  }, []);

  useEffect(() => {
    async function refreshReadings() {
      try {
        const liveReadings = await Promise.all(collectionPoints.map(fetchReading));

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

        setReadings(buildFallbackReadings(collectionPoints));
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
  }, [collectionPoints]);

  return {
    lastUpdated,
    locationStatus,
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
