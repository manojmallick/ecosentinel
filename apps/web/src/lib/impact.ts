export const IMPACT_STORAGE_KEY = "ecosentinel-impact-log-v1";

export type TripMode = "bike" | "transit" | "walk";

export type ImpactEntry = {
  co2KgAvoided: number;
  createdAt: string;
  distanceKm: number;
  id: string;
  mode: TripMode;
  points: number;
};

export type ImpactSummary = {
  communityCo2Kg: number;
  communityTrips: number;
  latestTrip: ImpactEntry | null;
  personalCo2Kg: number;
  personalPoints: number;
  recentEntries: ImpactEntry[];
  streakDays: number;
  tripsLogged: number;
};

const COMMUNITY_BASELINE = {
  co2Kg: 184.6,
  trips: 126
};

const MODE_LABELS: Record<TripMode, string> = {
  bike: "Bike ride",
  transit: "Transit trip",
  walk: "Walk"
};

const AVOIDED_CO2_PER_KM: Record<TripMode, number> = {
  bike: 0.192,
  walk: 0.192,
  transit: 0.11
};

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatTripMode(mode: TripMode) {
  return MODE_LABELS[mode];
}

export function calculateTripImpact(distanceKm: number, mode: TripMode) {
  const normalizedDistance = Math.max(0, distanceKm);
  const co2KgAvoided = roundToTenths(normalizedDistance * AVOIDED_CO2_PER_KM[mode]);
  const multiplier = mode === "transit" ? 11 : 14;
  const points = Math.max(8, Math.round(normalizedDistance * multiplier + co2KgAvoided * 24));

  return {
    co2KgAvoided,
    points
  };
}

export function createImpactEntry({
  createdAt = new Date().toISOString(),
  distanceKm,
  mode
}: {
  createdAt?: string;
  distanceKm: number;
  mode: TripMode;
}): ImpactEntry {
  const normalizedDistance = Number.parseFloat(distanceKm.toFixed(1));
  const impact = calculateTripImpact(normalizedDistance, mode);

  return {
    id: `${mode}-${createdAt}`,
    createdAt,
    distanceKm: normalizedDistance,
    mode,
    co2KgAvoided: impact.co2KgAvoided,
    points: impact.points
  };
}

function toDayKey(timestamp: string) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function calculateStreakDays(entries: ImpactEntry[]) {
  const uniqueDays = [...new Set(entries.map((entry) => toDayKey(entry.createdAt)))].sort().reverse();

  if (!uniqueDays.length) {
    return 0;
  }

  let streak = 1;
  let cursor = new Date(`${uniqueDays[0]}T00:00:00.000Z`);

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const expectedPrevious = new Date(cursor);
    expectedPrevious.setUTCDate(expectedPrevious.getUTCDate() - 1);
    const expectedKey = expectedPrevious.toISOString().slice(0, 10);

    if (uniqueDays[index] !== expectedKey) {
      break;
    }

    streak += 1;
    cursor = expectedPrevious;
  }

  return streak;
}

export function summariseImpact(entries: ImpactEntry[]): ImpactSummary {
  const sortedEntries = [...entries].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const personalCo2Kg = roundToTenths(
    sortedEntries.reduce((sum, entry) => sum + entry.co2KgAvoided, 0)
  );
  const personalPoints = sortedEntries.reduce((sum, entry) => sum + entry.points, 0);

  return {
    communityCo2Kg: roundToTenths(COMMUNITY_BASELINE.co2Kg + personalCo2Kg),
    communityTrips: COMMUNITY_BASELINE.trips + sortedEntries.length,
    latestTrip: sortedEntries[0] ?? null,
    personalCo2Kg,
    personalPoints,
    recentEntries: sortedEntries.slice(0, 4),
    streakDays: calculateStreakDays(sortedEntries),
    tripsLogged: sortedEntries.length
  };
}
