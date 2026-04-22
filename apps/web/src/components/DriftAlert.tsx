"use client";

import type { AqiReading } from "../lib/api";
import { evaluateDriftAlert } from "../lib/drift";
import type { ForecastResponse } from "../lib/forecast";

type DriftAlertProps = {
  forecast: ForecastResponse;
  forecastStatus: "idle" | "live" | "preview";
  reading: AqiReading;
};

export default function DriftAlert({ forecast, forecastStatus, reading }: DriftAlertProps) {
  const alert = evaluateDriftAlert({
    reading,
    forecast
  });

  const accentClasses = alert.shouldAlert
    ? alert.severity === "critical"
      ? "border-rose-400/40 bg-[linear-gradient(135deg,rgba(127,29,29,0.92),rgba(69,10,10,0.96))] shadow-[0_28px_100px_-60px_rgba(248,113,113,0.95)]"
      : "border-orange-300/40 bg-[linear-gradient(135deg,rgba(124,45,18,0.92),rgba(67,20,7,0.96))] shadow-[0_28px_100px_-60px_rgba(251,146,60,0.95)]"
    : "border-emerald-300/15 bg-[linear-gradient(135deg,rgba(6,78,59,0.76),rgba(15,23,42,0.92))] shadow-[0_28px_100px_-70px_rgba(52,211,153,0.55)]";

  const label = alert.shouldAlert ? "Drift alert" : "Drift monitor";

  return (
    <section className={`rounded-[2rem] border px-6 py-5 text-slate-50 backdrop-blur ${accentClasses}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.32em] text-white/70">{label}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {alert.shouldAlert
              ? `Actual AQI is ${alert.delta} points above forecast for ${reading.pointName}.`
              : `Forecast tracking is within the ${alert.threshold} AQI drift threshold.`}
          </h2>
          <p className="mt-3 text-sm leading-7 text-white/80">{alert.summary}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Actual now</div>
            <div className="mt-2 text-2xl font-semibold text-white">{alert.currentAqi}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Forecast +1h</div>
            <div className="mt-2 text-2xl font-semibold text-white">{alert.expectedAqi}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-white/60">Delta</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {alert.delta >= 0 ? "+" : ""}
              {alert.delta}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/70">
        <div>Monitoring {reading.pointName} against the next-hour AQI forecast.</div>
        <div>{forecastStatus === "live" ? "Live forecast payload" : "Preview forecast payload"}</div>
      </div>
    </section>
  );
}
