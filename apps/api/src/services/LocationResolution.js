const pool = require("../db/pool");

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
  findNearestCurrentReading,
  findNearestHistoryAnchor
};
