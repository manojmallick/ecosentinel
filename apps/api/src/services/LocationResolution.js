const pool = require("../db/pool");
const AQINormaliser = require("./AQINormaliser");
const { getNearestCity } = require("./iqair");
const { getLatestReadings } = require("./openaq");

const DEFAULT_READING_MAX_AGE_MINUTES = 90;

function getFreshnessConfigMinutes() {
  const configured = Number.parseInt(process.env.AQI_MAX_READING_AGE_MINUTES || DEFAULT_READING_MAX_AGE_MINUTES, 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_READING_MAX_AGE_MINUTES;
}

function getAgeMs(timestamp, now = new Date()) {
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, now.getTime() - value);
}

function classifyFreshness(timestamp, { now = new Date(), maxAgeMinutes = getFreshnessConfigMinutes() } = {}) {
  return getAgeMs(timestamp, now) <= maxAgeMinutes * 60_000 ? "current" : "stale";
}

function extractOpenAqPollutants(location) {
  const pollutants = {};

  for (const sensor of location?.sensors || []) {
    const parameter = sensor?.parameter?.name;
    const value = sensor?.latest?.value;

    if (!Number.isFinite(Number(value))) {
      continue;
    }

    if (parameter === "pm25") {
      pollutants.pm25 = Number(value);
    }

    if (parameter === "pm10") {
      pollutants.pm10 = Number(value);
    }

    if (parameter === "no2") {
      pollutants.no2 = Number(value);
    }

    if (parameter === "o3") {
      pollutants.o3 = Number(value);
    }
  }

  return pollutants;
}

function getOpenAqTimestamp(location) {
  const timestamps = (location?.sensors || [])
    .map((sensor) => sensor?.latest?.datetime?.utc)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function estimateSquaredDistance(lat, lng, candidateLat, candidateLng) {
  return (Number(candidateLat) - lat) ** 2 + (Number(candidateLng) - lng) ** 2;
}

function buildOpenAqReading(lat, lng, location) {
  const pollutants = extractOpenAqPollutants(location);
  if (Object.keys(pollutants).length === 0) {
    return null;
  }

  const normalised = AQINormaliser.calculateFromPollutants(pollutants);

  return {
    lat: Number(location?.coordinates?.latitude ?? lat),
    lng: Number(location?.coordinates?.longitude ?? lng),
    aqi: normalised.aqi,
    category: normalised.category,
    pm25: pollutants.pm25 ?? null,
    pm10: pollutants.pm10 ?? null,
    no2: pollutants.no2 ?? null,
    o3: pollutants.o3 ?? null,
    source: "openaq",
    recorded_at: getOpenAqTimestamp(location) || new Date().toISOString()
  };
}

function buildIqAirReading(lat, lng, iqairData) {
  const aqi = Number(iqairData?.current?.pollution?.aqius);
  if (!Number.isFinite(aqi)) {
    return null;
  }

  return {
    lat: Number(iqairData?.location?.coordinates?.latitude ?? lat),
    lng: Number(iqairData?.location?.coordinates?.longitude ?? lng),
    aqi,
    category: AQINormaliser.aqiToCategory(aqi),
    pm25: null,
    pm10: null,
    no2: null,
    o3: null,
    source: "iqair",
    recorded_at: iqairData?.current?.pollution?.ts || new Date().toISOString()
  };
}

async function findNearestCurrentReading({
  lat,
  lng,
  radiusDegrees,
  db = pool
}) {
  const localQuery = `
    SELECT lat, lng, aqi, category, pm25, pm10, no2, o3, source, recorded_at
    FROM aqi_readings
    WHERE lat BETWEEN $1::double precision - $3::double precision
      AND $1::double precision + $3::double precision
      AND lng BETWEEN $2::double precision - $3::double precision
      AND $2::double precision + $3::double precision
    ORDER BY POWER(lat - $1::double precision, 2) + POWER(lng - $2::double precision, 2), recorded_at DESC
    LIMIT 1
  `;

  const localResult = await db.query(localQuery, [lat, lng, radiusDegrees]);
  if (localResult.rows[0]) {
    return {
      reading: localResult.rows[0],
      resolution: "local"
    };
  }

  const nearestQuery = `
    SELECT lat, lng, aqi, category, pm25, pm10, no2, o3, source, recorded_at
    FROM aqi_readings
    ORDER BY POWER(lat - $1::double precision, 2) + POWER(lng - $2::double precision, 2), recorded_at DESC
    LIMIT 1
  `;
  const nearestResult = await db.query(nearestQuery, [lat, lng]);

  return {
    reading: nearestResult.rows[0] || null,
    resolution: nearestResult.rows[0] ? "nearest_available" : "none"
  };
}

async function persistReading(reading, { db = pool } = {}) {
  const insertQuery = `
    INSERT INTO aqi_readings (lat, lng, aqi, category, pm25, pm10, no2, o3, source, recorded_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `;

  await db.query(insertQuery, [
    reading.lat,
    reading.lng,
    reading.aqi,
    reading.category,
    reading.pm25,
    reading.pm10,
    reading.no2,
    reading.o3,
    reading.source,
    reading.recorded_at
  ]);
}

async function fetchRequestedLocationLiveReading({
  lat,
  lng,
  iqairClient = getNearestCity,
  openaqClient = getLatestReadings
}) {
  const openaqResults = await openaqClient(lat, lng, 10);
  const closestOpenAq = openaqResults
    .map((location) => ({
      location,
      distance: estimateSquaredDistance(
        lat,
        lng,
        location?.coordinates?.latitude ?? lat,
        location?.coordinates?.longitude ?? lng
      )
    }))
    .sort((left, right) => left.distance - right.distance)
    .map((entry) => buildOpenAqReading(lat, lng, entry.location))
    .find(Boolean);

  if (closestOpenAq) {
    return closestOpenAq;
  }

  const iqairData = await iqairClient(lat, lng);
  return buildIqAirReading(lat, lng, iqairData);
}

async function resolveCurrentReading({
  lat,
  lng,
  radiusDegrees,
  db = pool,
  liveFetcher = fetchRequestedLocationLiveReading,
  now = new Date(),
  maxAgeMinutes = getFreshnessConfigMinutes()
}) {
  const stored = await findNearestCurrentReading({
    lat,
    lng,
    radiusDegrees,
    db
  });

  const storedFreshness = stored.reading
    ? classifyFreshness(stored.reading.recorded_at, {
        now,
        maxAgeMinutes
      })
    : "stale";

  const shouldTryLive = !stored.reading || stored.resolution !== "local" || storedFreshness === "stale";

  if (shouldTryLive) {
    const liveReading = await liveFetcher({
      lat,
      lng
    });

    if (liveReading) {
      await persistReading(liveReading, { db });

      return {
        reading: liveReading,
        resolution: "requested_location",
        freshness: "live_provider"
      };
    }
  }

  return {
    reading: stored.reading,
    resolution: stored.resolution,
    freshness: stored.reading ? storedFreshness : "stale"
  };
}

async function findNearestHistoryAnchor({
  lat,
  lng,
  db = pool
}) {
  const nearestQuery = `
    SELECT lat, lng
    FROM aqi_readings
    ORDER BY POWER(lat - $1::double precision, 2) + POWER(lng - $2::double precision, 2), recorded_at DESC
    LIMIT 1
  `;
  const result = await db.query(nearestQuery, [lat, lng]);

  return result.rows[0] || null;
}

module.exports = {
  classifyFreshness,
  fetchRequestedLocationLiveReading,
  findNearestCurrentReading,
  findNearestHistoryAnchor,
  persistReading,
  resolveCurrentReading
};
