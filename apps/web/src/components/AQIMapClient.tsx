"use client";

import { Fragment, useMemo } from "react";
import type { LatLngExpression } from "leaflet";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { getAqiBand } from "../lib/aqiColors";
import { formatReadingFreshness, formatReadingResolution, type AqiReading } from "../lib/api";

type AQIMapClientProps = {
  readings: AqiReading[];
};

export default function AQIMapClient({ readings }: AQIMapClientProps) {
  const mapCenter = useMemo<LatLngExpression>(() => {
    const primaryReading = readings[0];
    return [primaryReading?.lat ?? 52.3676, primaryReading?.lng ?? 4.9041];
  }, [readings]);

  return (
    <MapContainer
      center={mapCenter}
      className="h-[420px] w-full rounded-[2rem]"
      key={Array.isArray(mapCenter) ? `${mapCenter[0]}-${mapCenter[1]}` : "fallback-center"}
      scrollWheelZoom={false}
      zoom={12}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {readings.map((reading) => {
        const band = getAqiBand(reading.aqi);
        const position: LatLngExpression = [reading.lat, reading.lng];

        return (
          <Fragment key={reading.pointName}>
            <Circle
              center={position}
              fillColor={band.color}
              fillOpacity={0.18}
              pathOptions={{ color: band.color, opacity: 0 }}
              radius={Math.max(900, reading.aqi * 55)}
            />
            <CircleMarker
              center={position}
              fillColor={band.color}
              fillOpacity={0.92}
              pathOptions={{ color: "#e2e8f0", weight: 2 }}
              radius={12}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">{reading.pointName}</div>
                  <div>
                    AQI {reading.aqi} · {reading.category}
                  </div>
                  <div className="text-slate-500">{formatReadingResolution(reading.resolution)}</div>
                  <div className="text-slate-500">
                    Source: {reading.source} · {formatReadingFreshness(reading.freshness)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
