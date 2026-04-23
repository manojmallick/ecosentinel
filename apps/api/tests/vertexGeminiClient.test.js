const {
  buildVertexGenerateContentUrl,
  callVertexGemini,
  extractVertexText,
  hasVertexGeminiConfig,
  parseServiceAccountJson
} = require("../src/services/VertexGeminiClient");

describe("VertexGeminiClient", () => {
  it("parses service account JSON from a base64 env value", () => {
    const serviceAccount = {
      client_email: "ecosentinel@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n"
    };

    expect(
      parseServiceAccountJson({
        serviceAccountJsonBase64: Buffer.from(JSON.stringify(serviceAccount)).toString("base64")
      })
    ).toEqual(serviceAccount);
  });

  it("builds the regional Vertex generateContent URL", () => {
    expect(
      buildVertexGenerateContentUrl({
        location: "europe-west4",
        model: "gemini-2.0-flash-001",
        projectId: "ecosentinel-demo"
      })
    ).toBe(
      "https://europe-west4-aiplatform.googleapis.com/v1/projects/ecosentinel-demo/locations/europe-west4/publishers/google/models/gemini-2.0-flash-001:generateContent"
    );
  });

  it("extracts candidate text from a Vertex Gemini response", () => {
    expect(
      extractVertexText({
        candidates: [
          {
            content: {
              parts: [{ text: "Current AQI is good." }, { text: "Cycling is reasonable." }]
            }
          }
        ]
      })
    ).toBe("Current AQI is good.\nCycling is reasonable.");
  });

  it("calls Vertex Gemini with system and user prompts", async () => {
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

    const reply = await callVertexGemini({
      accessTokenProvider: async () => "token",
      fetchImpl,
      location: "us-central1",
      model: "gemini-2.0-flash-001",
      projectId: "ecosentinel-demo",
      systemPrompt: "system prompt",
      userPrompt: "user prompt"
    });

    expect(reply).toBe("Gemini reply");
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/publishers/google/models/gemini-2.0-flash-001:generateContent"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token"
        }),
        body: expect.stringContaining("system prompt")
      })
    );
  });

  it("detects whether Vertex Gemini env configuration is present", () => {
    expect(
      hasVertexGeminiConfig({
        GOOGLE_CLOUD_PROJECT: "ecosentinel-demo",
        GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64: "abc"
      })
    ).toBe(true);
    expect(hasVertexGeminiConfig({ GOOGLE_CLOUD_PROJECT: "ecosentinel-demo" })).toBe(false);
  });
});
