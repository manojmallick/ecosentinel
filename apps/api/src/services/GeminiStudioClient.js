const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_API_ENDPOINT = "https://generativelanguage.googleapis.com";

function buildGeminiGenerateContentUrl({
  apiEndpoint = process.env.GEMINI_API_ENDPOINT || DEFAULT_API_ENDPOINT,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL
} = {}) {
  return `${apiEndpoint.replace(/\/$/, "")}/v1beta/models/${model}:generateContent`;
}

function extractGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim();

  if (!text) {
    throw new Error("Gemini API response did not include text");
  }

  return text;
}

async function callGeminiStudio({
  apiKey = process.env.GEMINI_API_KEY,
  fetchImpl = fetch,
  maxOutputTokens = 512,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  systemPrompt,
  temperature = 0.2,
  userPrompt
}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for Google AI Studio Gemini");
  }

  const response = await fetchImpl(
    buildGeminiGenerateContentUrl({
      model
    }),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: userPrompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens,
          temperature,
          thinkingConfig: {
            thinkingBudget: 0
          }
        },
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API responded with ${response.status}`);
  }

  return extractGeminiText(await response.json());
}

function hasGeminiStudioConfig(env = process.env) {
  return Boolean(env.GEMINI_API_KEY);
}

module.exports = {
  buildGeminiGenerateContentUrl,
  callGeminiStudio,
  extractGeminiText,
  hasGeminiStudioConfig
};
