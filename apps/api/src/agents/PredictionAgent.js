const fs = require("fs");
const path = require("path");

const pool = require("../db/pool");

const DEFAULT_INPUT_HOURS = 48;
const DEFAULT_OUTPUT_HOURS = 24;
const DEFAULT_MODEL_PATH = "../../ml/model/tfjs/model.json";
const DEFAULT_MODEL_VERSION = "lstm-v1.0.0";

let cachedModelPromise;

function getPredictionConfig() {
  return {
    inputHours: Number.parseInt(process.env.PREDICTION_INPUT_HOURS || DEFAULT_INPUT_HOURS, 10),
    outputHours: Number.parseInt(process.env.PREDICTION_OUTPUT_HOURS || DEFAULT_OUTPUT_HOURS, 10),
    modelPath: process.env.TFJS_MODEL_PATH || DEFAULT_MODEL_PATH,
    modelVersion: process.env.PREDICTION_MODEL_VERSION || DEFAULT_MODEL_VERSION
  };
}

function resolveModelPath(modelPath) {
  if (path.isAbsolute(modelPath)) {
    return modelPath;
  }

  return path.resolve(__dirname, modelPath);
}

async function loadPredictionModel({
  modelPath = getPredictionConfig().modelPath,
  tfLoader = async () => import("@tensorflow/tfjs-node")
} = {}) {
  const resolvedModelPath = resolveModelPath(modelPath);

  if (!fs.existsSync(resolvedModelPath)) {
    return null;
  }

  if (!cachedModelPromise) {
    cachedModelPromise = (async () => {
      try {
        const tf = await tfLoader();
        const model = await tf.loadLayersModel(`file://${resolvedModelPath}`);
        return {
          predict: async (windowValues) => {
            const tensor = tf.tensor3d([windowValues], [1, windowValues.length, 1]);
            const prediction = model.predict(tensor);
            const data = Array.from(await prediction.data());
            tf.dispose([tensor, prediction]);
            return data;
          }
        };
      } catch (error) {
        console.warn("[PredictionAgent] Failed to load TFJS model, using fallback forecast", error.message);
        return null;
      }
    })();
  }

  return cachedModelPromise;
}

function normaliseHistory(rows) {
  return [...rows]
    .map((row) => ({
      timestamp: row.recorded_at ?? row.timestamp,
      aqi: Number(row.aqi)
    }))
    .filter((row) => Number.isFinite(row.aqi))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

function buildInputWindow(readings, inputHours) {
  if (readings.length === 0) {
    return Array.from({ length: inputHours }, () => 0);
  }

  const values = readings.map((reading) => reading.aqi);
  const tail = values.slice(-inputHours);

  if (tail.length === inputHours) {
    return tail;
  }

  const padValue = tail[0];
  return Array.from({ length: inputHours - tail.length }, () => padValue).concat(tail);
}

function calculateConfidence(aqi, recentValues, hour) {
  if (recentValues.length === 0) {
    return {
      low: Math.max(0, Math.round(aqi - 6 - hour * 0.5)),
      high: Math.round(aqi + 6 + hour * 0.5)
    };
  }

  const mean = recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length;
  const variance =
    recentValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(recentValues.length, 1);
  const deviation = Math.sqrt(variance);
  const margin = Math.max(6, deviation * 1.5 + hour * 0.65);

  return {
    low: Math.max(0, Math.round(aqi - margin)),
    high: Math.round(aqi + margin)
  };
}

function createFallbackForecast(readings, outputHours) {
  const history = readings.map((reading) => reading.aqi);
  const recent = history.slice(-6);
  const baseline = recent.reduce((sum, value) => sum + value, 0) / Math.max(recent.length, 1);
  const trendWindow = history.slice(-12);
  const first = trendWindow[0] ?? baseline;
  const last = trendWindow[trendWindow.length - 1] ?? baseline;
  const trend = trendWindow.length > 1 ? (last - first) / (trendWindow.length - 1) : 0;

  return Array.from({ length: outputHours }, (_, index) => {
    const hour = index + 1;
    const wave = Math.sin(hour / 3) * 2.4;
    const projection = Math.max(0, Math.round(baseline + trend * hour + wave));

    return {
      hour,
      aqi: projection,
      confidence: calculateConfidence(projection, recent, hour)
    };
  });
}

function shapeModelForecast(predictions, readings, outputHours) {
  const recent = readings.map((reading) => reading.aqi).slice(-6);

  return Array.from({ length: outputHours }, (_, index) => {
    const hour = index + 1;
    const rawValue = predictions[index] ?? predictions[predictions.length - 1] ?? recent[recent.length - 1] ?? 0;
    const aqi = Math.max(0, Math.round(rawValue));

    return {
      hour,
      aqi,
      confidence: calculateConfidence(aqi, recent, hour)
    };
  });
}

async function fetchRecentReadings({
  lat,
  lng,
  inputHours = getPredictionConfig().inputHours,
  db = pool
}) {
  const query = `
    SELECT recorded_at, aqi
    FROM aqi_readings
    WHERE lat BETWEEN $1 - 0.05 AND $1 + 0.05
      AND lng BETWEEN $2 - 0.05 AND $2 + 0.05
    ORDER BY recorded_at DESC
    LIMIT $3
  `;

  const result = await db.query(query, [lat, lng, inputHours]);
  return normaliseHistory(result.rows);
}

async function forecastFromReadings(
  readings,
  {
    inputHours = getPredictionConfig().inputHours,
    outputHours = getPredictionConfig().outputHours,
    model = null
  } = {}
) {
  const windowValues = buildInputWindow(readings, inputHours);

  if (model?.predict) {
    try {
      const predictions = await model.predict(windowValues);
      return {
        forecast: shapeModelForecast(predictions, readings, outputHours),
        strategy: "lstm"
      };
    } catch (error) {
      console.warn("[PredictionAgent] Model prediction failed, using fallback forecast", error.message);
    }
  }

  return {
    forecast: createFallbackForecast(readings, outputHours),
    strategy: "fallback"
  };
}

async function generateForecast({
  lat,
  lng,
  now = new Date(),
  db = pool,
  model = undefined,
  config = getPredictionConfig()
}) {
  const readings = await fetchRecentReadings({
    lat,
    lng,
    inputHours: config.inputHours,
    db
  });

  if (readings.length === 0) {
    throw new Error("Not enough AQI history to generate a forecast");
  }

  const predictionModel = model === undefined ? await loadPredictionModel({ modelPath: config.modelPath }) : model;
  const result = await forecastFromReadings(readings, {
    inputHours: config.inputHours,
    outputHours: config.outputHours,
    model: predictionModel
  });

  return {
    lat,
    lng,
    generatedAt: now.toISOString(),
    modelVersion: config.modelVersion,
    strategy: result.strategy,
    sourceWindowHours: readings.length,
    forecast: result.forecast
  };
}

module.exports = {
  buildInputWindow,
  calculateConfidence,
  createFallbackForecast,
  fetchRecentReadings,
  forecastFromReadings,
  generateForecast,
  getPredictionConfig,
  loadPredictionModel,
  normaliseHistory,
  resolveModelPath,
  shapeModelForecast
};
