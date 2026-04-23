jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));
jest.mock("../src/services/openaq", () => ({
  getLatestReadings: jest.fn()
}));
jest.mock("../src/services/openMeteo", () => ({
  getCurrentAirQuality: jest.fn()
}));

const pool = require("../src/db/pool");
const { getCurrentAirQuality } = require("../src/services/openMeteo");
const { getLatestReadings } = require("../src/services/openaq");
const { resetLiveResolutionCache } = require("../src/services/LocationResolution");
const {
  answerCitizenQuestion,
  buildAdvisorContext,
  buildFallbackAdvice,
  chooseLlmProvider,
  fetchCurrentReading,
  summariseForecast
} = require("../src/agents/CitizenAdvisorAgent");

function buildForecast() {
  return {
    generatedAt: "2026-04-22T10:00:00.000Z",
    modelVersion: "lstm-v1.0.0",
    strategy: "fallback",
    forecast: [
      { hour: 1, aqi: 52, confidence: { low: 45, high: 60 } },
      { hour: 2, aqi: 58, confidence: { low: 50, high: 67 } },
      { hour: 3, aqi: 71, confidence: { low: 63, high: 80 } },
      { hour: 4, aqi: 66, confidence: { low: 58, high: 75 } }
    ]
  };
}

describe("CitizenAdvisorAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLiveResolutionCache();
    jest.useFakeTimers().setSystemTime(new Date("2026-04-22T09:30:00Z"));
    getCurrentAirQuality.mockResolvedValue(null);
    getLatestReadings.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fetches the nearest current AQI reading for advisor context", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lat: 52.3676,
          lng: 4.9041,
          aqi: 48,
          category: "Good",
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3,
          source: "openaq",
          recorded_at: "2026-04-22T09:00:00Z"
        }
      ]
    });

    const reading = await fetchCurrentReading({
      lat: 52.3676,
      lng: 4.9041
    });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM aqi_readings"), [
      52.3676,
      4.9041,
      expect.any(Number)
    ]);
    expect(reading).toEqual({
      lat: 52.3676,
      lng: 4.9041,
      aqi: 48,
      category: "Good",
      freshness: "current",
      pollutants: {
        pm25: 10.2,
        pm10: 18.5,
        no2: 22.1,
        o3: 55.3
      },
      resolution: "local",
      source: "openaq",
      timestamp: "2026-04-22T09:00:00Z"
    });
  });

  it("builds a compact advisor context with current and forecast data", () => {
    const context = buildAdvisorContext({
      currentReading: {
        lat: 52.3676,
        lng: 4.9041,
        aqi: 48,
        category: "Good",
        freshness: "current",
        resolution: "local",
        source: "openaq",
        timestamp: "2026-04-22T09:00:00Z",
        pollutants: {
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3
        }
      },
      forecast: buildForecast(),
      message: "Is it safe to cycle to school today?"
    });

    expect(context).toEqual({
      location: {
        lat: 52.3676,
        lng: 4.9041
      },
      current: {
        aqi: 48,
        category: "Good",
        freshness: "current",
        source: "openaq",
        timestamp: "2026-04-22T09:00:00Z",
        pollutants: {
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3
        },
        resolution: "local"
      },
      forecast: {
        generatedAt: "2026-04-22T10:00:00.000Z",
        modelVersion: "lstm-v1.0.0",
        strategy: "fallback",
        summary: {
          peakAqi: 71,
          peakHour: 3,
          shortTermAverage: 60
        },
        nextSixHours: buildForecast().forecast
      },
      userQuestion: "Is it safe to cycle to school today?"
    });
  });

  it("summarises the forecast peak and average for downstream advice", () => {
    expect(summariseForecast(buildForecast())).toEqual({
      peakAqi: 71,
      peakHour: 3,
      shortTermAverage: 60
    });
  });

  it("returns fallback advice when no OpenAI API key is configured", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lat: 52.3676,
          lng: 4.9041,
          aqi: 82,
          category: "Moderate",
          pm25: 21,
          pm10: 29,
          no2: 34,
          o3: 66,
          source: "openaq",
          recorded_at: "2026-04-22T09:00:00Z"
        }
      ]
    });

    const forecastAgent = jest.fn(async () => buildForecast());
    const response = await answerCitizenQuestion({
      message: "Can my daughter cycle to school?",
      lat: 52.3676,
      lng: 4.9041,
      forecastAgent,
      openAiApiKey: ""
    });

    expect(forecastAgent).toHaveBeenCalledWith({
      lat: 52.3676,
      lng: 4.9041,
      db: pool,
      signOutput: false
    });
    expect(response).toEqual({
      provider: "fallback",
      reply: expect.stringContaining("current AQI is 82 (Moderate)"),
      contextAqi: 82,
      contextCategory: "Moderate",
      contextFreshness: "current",
      contextResolution: "local",
      timestamp: expect.any(String),
      strategy: "fallback"
    });
  });

  it("uses the LLM client when an API key is configured", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lat: 52.3676,
          lng: 4.9041,
          aqi: 48,
          category: "Good",
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3,
          source: "openaq",
          recorded_at: "2026-04-22T09:00:00Z"
        }
      ]
    });

    const forecastAgent = jest.fn(async () => buildForecast());
    const llmClient = jest.fn(async () => "Current AQI is good, and cycling looks reasonable this morning.");

    const response = await answerCitizenQuestion({
      message: "Should I go for a run?",
      lat: 52.3676,
      lng: 4.9041,
      forecastAgent,
      llmClient,
      openAiApiKey: "test-key"
    });

    expect(llmClient).toHaveBeenCalledWith({
      apiKey: "test-key",
      model: "gpt-4o-mini",
      systemPrompt: expect.stringContaining("exactly 4 short bullet points"),
      userPrompt: expect.stringContaining("\"userQuestion\": \"Should I go for a run?\"")
    });
    expect(response).toEqual({
      provider: "openai",
      reply: "Current AQI is good, and cycling looks reasonable this morning.",
      contextAqi: 48,
      contextCategory: "Good",
      contextFreshness: "current",
      contextResolution: "local",
      timestamp: expect.any(String),
      strategy: "llm"
    });
  });

  it("uses the Vertex Gemini client when configured as the LLM provider", async () => {
    const originalProject = process.env.GOOGLE_CLOUD_PROJECT;
    const originalServiceAccount = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON;
    const restoreEnv = () => {
      if (originalProject === undefined) {
        delete process.env.GOOGLE_CLOUD_PROJECT;
      } else {
        process.env.GOOGLE_CLOUD_PROJECT = originalProject;
      }

      if (originalServiceAccount === undefined) {
        delete process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON;
      } else {
        process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON = originalServiceAccount;
      }
    };

    process.env.GOOGLE_CLOUD_PROJECT = "ecosentinel-demo";
    process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "ecosentinel@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n"
    });

    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lat: 52.3676,
          lng: 4.9041,
          aqi: 48,
          category: "Good",
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3,
          source: "openaq",
          recorded_at: "2026-04-22T09:00:00Z"
        }
      ]
    });

    const vertexClient = jest.fn(async () => "Gemini says current AQI is good for a short cycle.");

    try {
      const response = await answerCitizenQuestion({
        message: "Can I cycle?",
        lat: 52.3676,
        lng: 4.9041,
        forecastAgent: async () => buildForecast(),
        llmProvider: "vertex",
        vertexClient
      });

      expect(vertexClient).toHaveBeenCalledWith({
        systemPrompt: expect.stringContaining("exactly 4 short bullet points"),
        userPrompt: expect.stringContaining("\"userQuestion\": \"Can I cycle?\"")
      });
      expect(response).toEqual({
        provider: "vertex",
        reply: "Gemini says current AQI is good for a short cycle.",
        contextAqi: 48,
        contextCategory: "Good",
        contextFreshness: "current",
        contextResolution: "local",
        timestamp: expect.any(String),
        strategy: "llm"
      });
    } finally {
      restoreEnv();
    }
  });

  it("uses the Gemini Studio client when configured with an AI Studio API key", async () => {
    const originalGeminiApiKey = process.env.GEMINI_API_KEY;
    const restoreEnv = () => {
      if (originalGeminiApiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalGeminiApiKey;
      }
    };

    process.env.GEMINI_API_KEY = "gemini-test-key";
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lat: 52.3676,
          lng: 4.9041,
          aqi: 48,
          category: "Good",
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3,
          source: "openaq",
          recorded_at: "2026-04-22T09:00:00Z"
        }
      ]
    });

    const geminiClient = jest.fn(async () => "Gemini Studio says conditions look good for cycling.");

    try {
      const response = await answerCitizenQuestion({
        message: "Can I cycle?",
        lat: 52.3676,
        lng: 4.9041,
        forecastAgent: async () => buildForecast(),
        geminiClient,
        llmProvider: "gemini"
      });

      expect(geminiClient).toHaveBeenCalledWith({
        systemPrompt: expect.stringContaining("exactly 4 short bullet points"),
        userPrompt: expect.stringContaining("\"userQuestion\": \"Can I cycle?\"")
      });
      expect(response).toEqual({
        provider: "gemini",
        reply: "Gemini Studio says conditions look good for cycling.",
        contextAqi: 48,
        contextCategory: "Good",
        contextFreshness: "current",
        contextResolution: "local",
        timestamp: expect.any(String),
        strategy: "llm"
      });
    } finally {
      restoreEnv();
    }
  });

  it("prefers Vertex Gemini over OpenAI in auto mode when Vertex env is configured", () => {
    expect(
      chooseLlmProvider({
        env: {
          GOOGLE_CLOUD_PROJECT: "ecosentinel-demo",
          GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: "{}"
        },
        openAiApiKey: "openai-key"
      })
    ).toBe("vertex");
  });

  it("prefers Gemini Studio over Vertex and OpenAI in auto mode when a Gemini API key exists", () => {
    expect(
      chooseLlmProvider({
        env: {
          GEMINI_API_KEY: "gemini-key",
          GOOGLE_CLOUD_PROJECT: "ecosentinel-demo",
          GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: "{}"
        },
        openAiApiKey: "openai-key"
      })
    ).toBe("gemini");
  });

  it("falls back when the LLM client fails", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          lat: 52.3676,
          lng: 4.9041,
          aqi: 108,
          category: "USG",
          pm25: 38,
          pm10: 54,
          no2: 63,
          o3: 74,
          source: "openaq",
          recorded_at: "2026-04-22T09:00:00Z"
        }
      ]
    });

    const response = await answerCitizenQuestion({
      message: "Is it okay for my child to walk outside?",
      lat: 52.3676,
      lng: 4.9041,
      forecastAgent: async () => buildForecast(),
      llmClient: async () => {
        throw new Error("upstream failure");
      },
      openAiApiKey: "test-key"
    });

    expect(response.strategy).toBe("fallback");
    expect(response.provider).toBe("fallback");
    expect(response.reply).toContain("Children, older adults, and people with asthma");
    expect(response.contextAqi).toBe(108);
  });

  it("can build a deterministic fallback reply directly", () => {
    const reply = buildFallbackAdvice({
      currentReading: {
        lat: 52.3676,
        lng: 4.9041,
        aqi: 48,
        category: "Good",
        source: "openaq",
        timestamp: "2026-04-22T09:00:00Z",
        pollutants: {
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3
        }
      },
      forecast: buildForecast(),
      message: "Can I cycle?"
    });

    expect(reply).toContain('For your question "Can I cycle?"');
    expect(reply).toContain("forecast peaks around hour 3");
  });
});
