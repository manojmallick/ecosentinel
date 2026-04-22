import { describeAqi, formatPollutant, getAqiBand } from "../lib/aqiColors";
import type { AqiReading } from "../lib/api";

type AQICardProps = {
  reading: AqiReading;
};

export default function AQICard({ reading }: AQICardProps) {
  const band = getAqiBand(reading.aqi);

  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-slate-950/75 p-5 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.9)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{reading.pointName}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{describeAqi(reading.aqi)}</h3>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950"
          style={{ backgroundColor: band.color }}
        >
          {reading.category}
        </span>
      </div>

      <div className="mt-6 flex items-end gap-4">
        <div className="text-5xl font-semibold text-white">{reading.aqi}</div>
        <div className="pb-2 text-sm text-slate-400">
          Source {reading.source}
          <div className="mt-1">Updated {new Date(reading.timestamp).toLocaleTimeString()}</div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-300">
        <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
          <dt className="text-slate-400">PM2.5</dt>
          <dd className="mt-1 text-lg font-medium text-white">{formatPollutant(reading.pollutants.pm25)}</dd>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
          <dt className="text-slate-400">PM10</dt>
          <dd className="mt-1 text-lg font-medium text-white">{formatPollutant(reading.pollutants.pm10)}</dd>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
          <dt className="text-slate-400">NO2</dt>
          <dd className="mt-1 text-lg font-medium text-white">{formatPollutant(reading.pollutants.no2)}</dd>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
          <dt className="text-slate-400">O3</dt>
          <dd className="mt-1 text-lg font-medium text-white">{formatPollutant(reading.pollutants.o3)}</dd>
        </div>
      </dl>
    </article>
  );
}
