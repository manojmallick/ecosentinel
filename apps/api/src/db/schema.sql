CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS aqi_readings (
  id BIGSERIAL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  aqi INTEGER NOT NULL,
  category TEXT NOT NULL,
  pm25 DOUBLE PRECISION,
  pm10 DOUBLE PRECISION,
  no2 DOUBLE PRECISION,
  o3 DOUBLE PRECISION,
  source TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
);

SELECT create_hypertable('aqi_readings', 'recorded_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_aqi_readings_location
  ON aqi_readings (lat, lng, recorded_at DESC);

CREATE TABLE IF NOT EXISTS predictions (
  id BIGSERIAL PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  forecast_json JSONB NOT NULL,
  signature TEXT NOT NULL,
  public_key TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'lstm-v1.0.0',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS impact_scores (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  trips INTEGER NOT NULL DEFAULT 0,
  co2_saved DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

