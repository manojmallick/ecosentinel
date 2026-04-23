const pool = require("../db/pool");
const { callGeminiStudio, hasGeminiStudioConfig } = require("../services/GeminiStudioClient");
const { callVertexGemini, hasVertexGeminiConfig } = require("../services/VertexGeminiClient");

const { generateForecast } = require("./PredictionAgent");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_LLM_PROVIDER = process.env.LLM_PROVIDER || "auto";

function parseCoordinate(value, fallback) {
  const parsed = Number.parseFloat(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchCurrentReading({
  lat,
  lng,
  db = pool
}) {
  const query = `
    SELECT lat, lng, aqi, category, pm25, pm10, no2, o3, source, recorded_at
    FROM aqi_readings
    WHERE lat BETWEEN $1::double precision - 0.05 AND $1::double precision + 0.05
      AND lng BETWEEN $2::double precision - 0.05 AND $2::double precision + 0.05
    ORDER BY POWER(lat - $1::double precision, 2) + POWER(lng - $2::double precision, 2), recorded_at DESC
    LIMIT 1
  `;

  const result = await db.query(query, [lat, lng]);
  const row = result.rows[0];

  if (!row) {
    throw new Error("No AQI reading available for advisor context");
  }

  return {
    lat: row.lat,
    lng: row.lng,
    aqi: Number(row.aqi),
    category: row.category,
    pollutants: {
      pm25: row.pm25,
      pm10: row.pm10,
      no2: row.no2,
      o3: row.o3
    },
    source: row.source,
    timestamp: row.recorded_at
  };
}

function summariseForecast(forecast) {
  const peakPoint = forecast.forecast.reduce((current, point) => {
    return point.aqi > current.aqi ? point : current;
  }, forecast.forecast[0]);

  const nextThreeHours = forecast.forecast.slice(0, 3);
  const shortTermAverage = Math.round(
    nextThreeHours.reduce((sum, point) => sum + point.aqi, 0) / Math.max(nextThreeHours.length, 1)
  );

  return {
    peakAqi: peakPoint.aqi,
    peakHour: peakPoint.hour,
    shortTermAverage
  };
}

function buildAdvisorContext({
  currentReading,
  forecast,
  message
}) {
  const summary = summariseForecast(forecast);

  return {
    location: {
      lat: currentReading.lat,
      lng: currentReading.lng
    },
    current: {
      aqi: currentReading.aqi,
      category: currentReading.category,
      source: currentReading.source,
      timestamp: currentReading.timestamp,
      pollutants: currentReading.pollutants
    },
    forecast: {
      generatedAt: forecast.generatedAt,
      modelVersion: forecast.modelVersion,
      strategy: forecast.strategy,
      summary,
      nextSixHours: forecast.forecast.slice(0, 6)
    },
    userQuestion: message
  };
}

function buildSystemPrompt() {
  return [
    "You are EcoSentinel's citizen air-quality advisor for Amsterdam.",
    "Answer in plain language, stay concise, and prioritize safety guidance.",
    "Respond with exactly 4 short bullet points and no greeting or sign-off.",
    "Bullet 1: current AQI and category.",
    "Bullet 2: near-term forecast risk.",
    "Bullet 3: practical recommendation for the user's plan.",
    "Bullet 4: caution for sensitive groups if relevant, otherwise say no special caution is needed.",
    "Keep the total response under 90 words and make each bullet a complete thought.",
    "Use the provided AQI context only. Do not invent medical facts or unsupported claims.",
    "Mention current AQI, near-term forecast risk, and one practical recommendation.",
    "If AQI is elevated, include a caution for sensitive groups such as children, elderly residents, or people with asthma."
  ].join(" ");
}

function buildUserPrompt(context) {
  return JSON.stringify(context, null, 2);
}

function buildFallbackAdvice({
  currentReading,
  forecast,
  message
}) {
  const summary = summariseForecast(forecast);
  const isSensitiveWarning = currentReading.aqi >= 100 || summary.peakAqi >= 100;
  const shortTermTrend =
    summary.peakAqi > currentReading.aqi + 10 ? "Air quality is expected to worsen later today." : "No sharp spike is forecast in the next few hours.";

  const recommendation =
    currentReading.aqi <= 50
      ? "Outdoor activity looks reasonable right now."
      : currentReading.aqi <= 100
        ? "Consider reducing prolonged outdoor exertion if you are sensitive to pollution."
        : "It would be safer to reduce outdoor exertion and keep windows closed during the peak period.";

  return [
    `For your question "${message}", current AQI is ${currentReading.aqi} (${currentReading.category}).`,
    `${shortTermTrend} The forecast peaks around hour ${summary.peakHour} at roughly AQI ${summary.peakAqi}.`,
    recommendation,
    isSensitiveWarning
      ? "Children, older adults, and people with asthma or other respiratory conditions should take extra care."
      : "Sensitive groups should still monitor symptoms if they plan long outdoor exposure."
  ].join(" ");
}

async function callOpenAIResponses({
  apiKey = process.env.OPENAI_API_KEY,
  model = DEFAULT_MODEL,
  systemPrompt,
  userPrompt,
  fetchImpl = fetch
}) {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI responded with ${response.status}`);
  }

  const payload = await response.json();

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const fallbackText = payload.output
    ?.flatMap((item) => item.content || [])
    ?.map((item) => item.text)
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim();

  if (!fallbackText) {
    throw new Error("OpenAI response did not include output text");
  }

  return fallbackText;
}

function chooseLlmProvider({
  env = process.env,
  llmProvider = DEFAULT_LLM_PROVIDER,
  openAiApiKey = env.OPENAI_API_KEY
} = {}) {
  if (llmProvider === "gemini") {
    return hasGeminiStudioConfig(env) ? "gemini" : null;
  }

  if (llmProvider === "vertex") {
    return hasVertexGeminiConfig(env) ? "vertex" : null;
  }

  if (llmProvider === "openai") {
    return openAiApiKey ? "openai" : null;
  }

  if (hasGeminiStudioConfig(env)) {
    return "gemini";
  }

  if (hasVertexGeminiConfig(env)) {
    return "vertex";
  }

  if (openAiApiKey) {
    return "openai";
  }

  return null;
}

async function answerCitizenQuestion({
  message,
  lat = 52.3676,
  lng = 4.9041,
  db = pool,
  forecastAgent = generateForecast,
  geminiClient = callGeminiStudio,
  llmClient,
  llmProvider = DEFAULT_LLM_PROVIDER,
  openAiApiKey = process.env.OPENAI_API_KEY,
  vertexClient = callVertexGemini,
  model = DEFAULT_MODEL
}) {
  const latCoord = parseCoordinate(lat, 52.3676);
  const lngCoord = parseCoordinate(lng, 4.9041);

  if (!message || !message.trim()) {
    throw new Error("Citizen advisor message is required");
  }

  if (latCoord == null || lngCoord == null) {
    throw new Error("Citizen advisor coordinates must be valid numbers");
  }

  const currentReading = await fetchCurrentReading({
    lat: latCoord,
    lng: lngCoord,
    db
  });

  const forecast = await forecastAgent({
    lat: latCoord,
    lng: lngCoord,
    db,
    signOutput: false
  });

  const context = buildAdvisorContext({
    currentReading,
    forecast,
    message: message.trim()
  });

  const fallbackReply = buildFallbackAdvice({
    currentReading,
    forecast,
    message: message.trim()
  });

  const configuredProvider = chooseLlmProvider({
    llmProvider,
    openAiApiKey
  });

  if (!llmClient && !configuredProvider) {
    return {
      provider: "fallback",
      reply: fallbackReply,
      contextAqi: currentReading.aqi,
      contextCategory: currentReading.category,
      timestamp: new Date().toISOString(),
      strategy: "fallback"
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(context);
    const userPrompt = buildUserPrompt(context);
    const reply =
      configuredProvider === "gemini" && !llmClient
        ? await geminiClient({
            systemPrompt,
            userPrompt
          })
        : configuredProvider === "vertex" && !llmClient
        ? await vertexClient({
            systemPrompt,
            userPrompt
          })
        : await (llmClient || callOpenAIResponses)({
            apiKey: openAiApiKey,
            model,
            systemPrompt,
            userPrompt
          });

    return {
      provider: configuredProvider,
      reply,
      contextAqi: currentReading.aqi,
      contextCategory: currentReading.category,
      timestamp: new Date().toISOString(),
      strategy: "llm"
    };
  } catch (_error) {
    return {
      provider: "fallback",
      reply: fallbackReply,
      contextAqi: currentReading.aqi,
      contextCategory: currentReading.category,
      timestamp: new Date().toISOString(),
      strategy: "fallback"
    };
  }
}

module.exports = {
  answerCitizenQuestion,
  buildAdvisorContext,
  buildFallbackAdvice,
  buildSystemPrompt,
  buildUserPrompt,
  callOpenAIResponses,
  chooseLlmProvider,
  fetchCurrentReading,
  parseCoordinate,
  summariseForecast
};
