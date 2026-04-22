jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));

const pool = require("../src/db/pool");
const {
  answerCitizenQuestion,
  buildAdvisorContext,
  buildFallbackAdvice,
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

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("FROM aqi_readings"), [52.3676, 4.9041]);
    expect(reading).toEqual({
      lat: 52.3676,
      lng: 4.9041,
      aqi: 48,
      category: "Good",
      pollutants: {
        pm25: 10.2,
        pm10: 18.5,
        no2: 22.1,
        o3: 55.3
      },
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
        source: "openaq",
        timestamp: "2026-04-22T09:00:00Z",
        pollutants: {
          pm25: 10.2,
          pm10: 18.5,
          no2: 22.1,
          o3: 55.3
        }
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
      reply: expect.stringContaining("current AQI is 82 (Moderate)"),
      contextAqi: 82,
      contextCategory: "Moderate",
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
      systemPrompt: expect.stringContaining("citizen air-quality advisor"),
      userPrompt: expect.stringContaining("\"userQuestion\": \"Should I go for a run?\"")
    });
    expect(response).toEqual({
      reply: "Current AQI is good, and cycling looks reasonable this morning.",
      contextAqi: 48,
      contextCategory: "Good",
      timestamp: expect.any(String),
      strategy: "llm"
    });
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
