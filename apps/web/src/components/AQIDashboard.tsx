"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import AQICard from "./AQICard";
import AQIMap from "./AQIMap";
import DriftAlert from "./DriftAlert";
import ImpactScore from "./ImpactScore";
import { getAqiBand } from "../lib/aqiColors";
import { formatReadingFreshness, formatReadingResolution, useAqiReadings, useForecast } from "../lib/api";

const ForecastChart = dynamic(() => import("./ForecastChart"), {
  loading: () => (
    <div className="flex min-h-[360px] items-center justify-center rounded-[2rem] border border-white/10 bg-slate-950/75 text-sm uppercase tracking-[0.25em] text-slate-400">
      Loading forecast
    </div>
  ),
  ssr: false
});

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

export default function AQIDashboard() {
  const { readings, status, lastUpdated, locationStatus } = useAqiReadings();
  const { forecast, status: forecastStatus } = useForecast(readings[0]);
  const primaryReading = readings[0];
  const worstReading = readings.reduce((current, reading) => {
    return reading.aqi > current.aqi ? reading : current;
  }, readings[0]);
  const averageAqi = Math.round(readings.reduce((sum, reading) => sum + reading.aqi, 0) / readings.length);
  const averageBand = getAqiBand(averageAqi);
  const reportHref = `${API_BASE_URL}/api/report?lat=${primaryReading.lat}&lng=${primaryReading.lng}&hours=24`;

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.22),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/10 bg-slate-950/70 p-8 shadow-[0_35px_120px_-60px_rgba(34,197,94,0.8)] backdrop-blur">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.24),_transparent_65%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-300">EcoSentinel F-14</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                Interactive AQI map, forecast outlook, citizen chat, drift monitoring, and community impact in one dashboard.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                The dashboard pairs live or stored AQI hotspots with a 24-hour forecast curve, a guided
                handoff into the citizen advisor experience, a drift monitor that warns when reality outruns
                the model by 20 AQI points, and a gamified impact tracker for car-free trips.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                  href="/chat"
                >
                  Open citizen advisor
                </Link>
                <a
                  className="inline-flex items-center justify-center rounded-full border border-sky-300/30 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-200/50 hover:bg-sky-400/20"
                  href={reportHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  Download PDF report
                </a>
                <div className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200">
                  Requested-location data with visible fallback labels
                </div>
              </div>
            </div>

            <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Network status</div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {status === "live" ? "Live API polling" : "Preview fallback data"}
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  Last refresh {new Date(lastUpdated).toLocaleTimeString()}
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  {formatReadingResolution(primaryReading.resolution)} · {formatReadingFreshness(primaryReading.freshness)}
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  {locationStatus === "granted"
                    ? `Using browser location near ${primaryReading.pointName.toLowerCase()}`
                    : locationStatus === "locating"
                      ? "Requesting browser location"
                      : "Using default fallback location"}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Highest nearby reading</div>
                  <div className="mt-3 text-xl font-semibold text-white">{worstReading.pointName}</div>
                  <div className="mt-1 text-sm text-slate-300">{worstReading.aqi} AQI</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Nearby average</div>
                  <div className="mt-3 text-xl font-semibold text-white">{averageAqi} AQI</div>
                  <div className="mt-1 text-sm text-slate-300">{averageBand.label} overall</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <DriftAlert forecast={forecast} forecastStatus={forecastStatus} reading={readings[0]} />

        <section className="grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_35px_110px_-70px_rgba(56,189,248,0.9)] backdrop-blur">
            <div className="mb-4 flex items-center justify-between px-3 pt-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Interactive map</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Live AQI field around you</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                Leaflet view
              </div>
            </div>
            <AQIMap readings={readings} />
          </div>

          <div className="grid gap-5">
            {readings.map((reading) => (
              <AQICard key={reading.pointName} reading={reading} />
            ))}
          </div>
        </section>

        <ForecastChart forecast={forecast} status={forecastStatus} />

        <ImpactScore />
      </div>
    </main>
  );
}
