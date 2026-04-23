const pool = require("../db/pool");
const AQINormaliser = require("../services/AQINormaliser");
const { getLatestReadings } = require("../services/openaq");
const { getNearestCity } = require("../services/iqair");

const COLLECTION_POINTS = [
  { lat: 52.3676, lng: 4.9041, name: "Amsterdam Centre" },
  { lat: 52.3402, lng: 4.8952, name: "Amsterdam South" },
  { lat: 52.3792, lng: 4.9007, name: "Amsterdam North" }
];

function extractPollutants(location) {
  const pollutants = {};

  for (const sensor of location?.sensors || []) {
    const parameter = sensor?.parameter?.name;
    const value = sensor?.latest?.value;

    if (parameter === "pm25") {
      pollutants.pm25 = value;
    }

    if (parameter === "pm10") {
      pollutants.pm10 = value;
    }

    if (parameter === "no2") {
      pollutants.no2 = value;
    }

    if (parameter === "o3") {
      pollutants.o3 = value;
    }
  }

  return pollutants;
}

function buildInsertStatement(readings) {
  return `
    INSERT INTO aqi_readings (lat, lng, aqi, category, pm25, pm10, no2, o3, source)
    VALUES ${readings
      .map((_, index) => {
        const offset = index * 9;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
      })
      .join(", ")}
  `;
}

function flattenReadings(readings) {
  return readings.flatMap((reading) => [
    reading.lat,
    reading.lng,
    reading.aqi,
    reading.category,
    reading.pm25 ?? null,
    reading.pm10 ?? null,
    reading.no2 ?? null,
    reading.o3 ?? null,
    reading.source
  ]);
}

async function collect() {
  console.log("[DataCollector] Starting collection run:", new Date().toISOString());
  const collectedReadings = [];

  for (const point of COLLECTION_POINTS) {
    const openaqResults = await getLatestReadings(point.lat, point.lng);
    let hasOpenAqReadingForPoint = false;

    for (const location of openaqResults.slice(0, 3)) {
      const pollutants = extractPollutants(location);

      if (Object.keys(pollutants).length === 0) {
        continue;
      }

      const normalised = AQINormaliser.calculateFromPollutants(pollutants);

      collectedReadings.push({
        lat: location?.coordinates?.latitude ?? point.lat,
        lng: location?.coordinates?.longitude ?? point.lng,
        aqi: normalised.aqi,
        category: normalised.category,
        pm25: pollutants.pm25 ?? null,
        pm10: pollutants.pm10 ?? null,
        no2: pollutants.no2 ?? null,
        o3: pollutants.o3 ?? null,
        source: "openaq"
      });
      hasOpenAqReadingForPoint = true;
    }

    if (hasOpenAqReadingForPoint) {
      continue;
    }

    const iqairData = await getNearestCity(point.lat, point.lng);
    const iqairAqi = iqairData?.current?.pollution?.aqius;

    if (iqairAqi != null) {
      collectedReadings.push({
        lat: point.lat,
        lng: point.lng,
        aqi: Number(iqairAqi),
        category: AQINormaliser.aqiToCategory(Number(iqairAqi)),
        pm25: null,
        pm10: null,
        no2: null,
        o3: null,
        source: "iqair"
      });
    }
  }

  if (collectedReadings.length === 0) {
    console.log("[DataCollector] No readings collected");
    return 0;
  }

  await pool.query(buildInsertStatement(collectedReadings), flattenReadings(collectedReadings));
  console.log(`[DataCollector] Inserted ${collectedReadings.length} readings`);

  return collectedReadings.length;
}

module.exports = {
  COLLECTION_POINTS,
  buildInsertStatement,
  collect,
  extractPollutants,
  flattenReadings
};
