"use client";

import { useEffect, useMemo, useState } from "react";

import {
  IMPACT_STORAGE_KEY,
  createImpactEntry,
  formatTripMode,
  summariseImpact,
  type ImpactEntry,
  type TripMode
} from "../lib/impact";

const DEFAULT_MODE: TripMode = "bike";

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ImpactScore() {
  const [distanceKm, setDistanceKm] = useState("5");
  const [entries, setEntries] = useState<ImpactEntry[]>([]);
  const [mode, setMode] = useState<TripMode>(DEFAULT_MODE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedEntries = window.localStorage.getItem(IMPACT_STORAGE_KEY);

      if (storedEntries) {
        const parsedEntries = JSON.parse(storedEntries) as ImpactEntry[];
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : []);
      }
    } catch (_error) {
      setEntries([]);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(IMPACT_STORAGE_KEY, JSON.stringify(entries));
  }, [entries, isHydrated]);

  const summary = useMemo(() => summariseImpact(entries), [entries]);

  function logTrip() {
    const parsedDistance = Number.parseFloat(distanceKm);

    if (!Number.isFinite(parsedDistance) || parsedDistance <= 0) {
      setError("Enter a valid trip distance in kilometers.");
      return;
    }

    setError(null);
    setEntries((currentEntries) => [
      createImpactEntry({
        distanceKm: parsedDistance,
        mode
      }),
      ...currentEntries
    ]);
  }

  return (
    <section className="rounded-[2rem] border border-emerald-200/10 bg-slate-950/75 p-6 shadow-[0_35px_120px_-70px_rgba(34,197,94,0.75)] backdrop-blur">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Impact score</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Turn clean travel into a visible community win</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Log a car-free trip, watch your personal score climb, and show how individual choices can
            compound into meaningful avoided CO₂ across Amsterdam.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Personal score</div>
              <div className="mt-2 text-3xl font-semibold text-white">{summary.personalPoints}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CO₂ avoided</div>
              <div className="mt-2 text-3xl font-semibold text-white">{summary.personalCo2Kg} kg</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Current streak</div>
              <div className="mt-2 text-3xl font-semibold text-white">{summary.streakDays} days</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Community total</div>
              <div className="mt-2 text-3xl font-semibold text-white">{summary.communityCo2Kg} kg</div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(15,23,42,0.6))] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-emerald-200">Community movement</div>
                <div className="mt-2 text-xl font-semibold text-white">{summary.communityTrips} logged car-free trips</div>
              </div>
              <div className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                {summary.latestTrip
                  ? `Latest: ${formatTripMode(summary.latestTrip.mode)} · ${summary.latestTrip.distanceKm} km`
                  : "No trips logged yet"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Log a trip</p>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-slate-200">Distance (km)</span>
                <input
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-emerald-300/40"
                  inputMode="decimal"
                  onChange={(event) => {
                    setDistanceKm(event.target.value);
                  }}
                  value={distanceKm}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-slate-200">Mode</span>
                <select
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-emerald-300/40"
                  onChange={(event) => {
                    setMode(event.target.value as TripMode);
                  }}
                  value={mode}
                >
                  <option value="bike">Bike ride</option>
                  <option value="walk">Walk</option>
                  <option value="transit">Transit trip</option>
                </select>
              </label>

              <button
                className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                onClick={logTrip}
                type="button"
              >
                Log car-free trip
              </button>

              {error ? <div className="text-sm text-rose-300">{error}</div> : null}
              {!isHydrated ? <div className="text-sm text-slate-400">Loading saved progress…</div> : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Recent impact</p>
            <div className="mt-4 grid gap-3">
              {summary.recentEntries.length ? (
                summary.recentEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-white">{formatTripMode(entry.mode)}</div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        +{entry.points} pts
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {entry.distanceKm} km · {entry.co2KgAvoided} kg CO₂ avoided
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{formatTimestamp(entry.createdAt)}</div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-400">
                  Your first logged trip will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
