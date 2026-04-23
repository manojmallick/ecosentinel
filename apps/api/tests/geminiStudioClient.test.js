const {
  buildGeminiGenerateContentUrl,
  callGeminiStudio,
  extractGeminiText,
  hasGeminiStudioConfig
} = require("../src/services/GeminiStudioClient");

describe("GeminiStudioClient", () => {
  it("builds the Google AI Studio generateContent URL", () => {
    expect(
      buildGeminiGenerateContentUrl({
        model: "gemini-2.5-flash"
      })
    ).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  });

  it("extracts candidate text from a Gemini API response", () => {
    expect(
      extractGeminiText({
        candidates: [
          {
            content: {
              parts: [{ text: "Current AQI is good." }, { text: "A short ride looks fine." }]
            }
          }
        ]
      })
    ).toBe("Current AQI is good.\nA short ride looks fine.");
  });

  it("calls the Gemini API with the AI Studio API key header", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Gemini reply" }]
            }
          }
        ]
      })
    }));

    const reply = await callGeminiStudio({
      apiKey: "gemini-key",
      fetchImpl,
      model: "gemini-2.5-flash",
      systemPrompt: "system prompt",
      userPrompt: "user prompt"
    });

    expect(reply).toBe("Gemini reply");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-goog-api-key": "gemini-key"
        }),
        body: expect.stringContaining("\"thinkingBudget\":0")
      })
    );
  });

  it("detects whether Gemini Studio config is present", () => {
    expect(hasGeminiStudioConfig({ GEMINI_API_KEY: "gemini-key" })).toBe(true);
    expect(hasGeminiStudioConfig({})).toBe(false);
  });
});
