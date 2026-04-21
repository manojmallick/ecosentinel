INSERT INTO aqi_readings (lat, lng, aqi, category, pm25, pm10, no2, o3, source, recorded_at)
SELECT
  52.3676 + (random() * 0.05 - 0.025),
  4.9041 + (random() * 0.05 - 0.025),
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 13 AND 16
      AND ts::DATE = '2026-04-15' THEN 75 + (random() * 10)::INTEGER
    ELSE 35 + (random() * 25)::INTEGER
  END,
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 13 AND 16
      AND ts::DATE = '2026-04-15' THEN 'Moderate'
    ELSE 'Good'
  END,
  8 + random() * 8,
  12 + random() * 12,
  18 + random() * 15,
  45 + random() * 20,
  'simulated',
  ts
FROM generate_series(
  '2026-04-11 00:00:00+00'::TIMESTAMPTZ,
  '2026-04-17 23:00:00+00'::TIMESTAMPTZ,
  INTERVAL '1 hour'
) AS ts;
