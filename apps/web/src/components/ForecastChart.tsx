"use client";

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getAqiBand } from "../lib/aqiColors";
import type { ForecastResponse } from "../lib/forecast";
import { describeForecastHistoryResolution, summariseForecast, toForecastChartData } from "../lib/forecast";

type ForecastChartProps = {
  forecast: ForecastResponse;
  status: "idle" | "live" | "preview";
};

export default function ForecastChart({ forecast, status }: ForecastChartProps) {
  const chartData = toForecastChartData(forecast.forecast);
  const summary = summariseForecast(forecast.forecast);
  const peakBand = getAqiBand(summary.peakAqi);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_35px_120px_-70px_rgba(14,165,233,0.65)] backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">24-hour forecast</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">AQI outlook with confidence band</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            {status === "live"
              ? forecast.historyResolution === "nearest_available"
                ? "Forecast loaded from the backend using the nearest available AQI history window for this location."
                : "Forecast loaded from the backend using the local AQI history window."
              : "Preview forecast generated locally until the /api/predict route is available."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Peak hour</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.peakHour}h</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Peak AQI</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.peakAqi}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Average</div>
            <div className="mt-2 text-2xl font-semibold text-white">{summary.averageAqi}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.15em]" style={{ color: peakBand.color }}>
              {peakBand.label}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 h-[320px] min-h-[320px] min-w-0 w-full">
        <ResponsiveContainer height="100%" minWidth={0} width="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 6, left: -20, bottom: 0 }}>
            <XAxis
              axisLine={false}
              dataKey="hour"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={["dataMin - 8", "dataMax + 8"]}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                borderRadius: "18px",
                color: "#e2e8f0"
              }}
              formatter={(value, name) => {
                const numericValue =
                  typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));

                if (name === "aqi") {
                  return [`${numericValue} AQI`, "Forecast"];
                }

                if (name === "high") {
                  return [`${numericValue} AQI`, "Confidence high"];
                }

                if (name === "low") {
                  return [`${numericValue} AQI`, "Confidence low"];
                }

                return [numericValue, String(name)];
              }}
            />
            <Area dataKey="bandBase" fillOpacity={0} stackId="confidence" strokeOpacity={0} />
            <Area
              animationDuration={900}
              dataKey="bandSpread"
              fill="rgba(56, 189, 248, 0.18)"
              stackId="confidence"
              strokeOpacity={0}
            />
            <Line
              animationDuration={900}
              dataKey="aqi"
              dot={false}
              stroke="#38bdf8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div>Generated {new Date(forecast.generatedAt).toLocaleTimeString()}</div>
        <div>{describeForecastHistoryResolution(forecast.historyResolution)}</div>
        <div>
          Model {forecast.modelVersion} · Strategy {forecast.strategy}
        </div>
        <div>{forecast.signature ? "Signed forecast payload" : "Unsigned preview payload"}</div>
      </div>
    </section>
  );
}
