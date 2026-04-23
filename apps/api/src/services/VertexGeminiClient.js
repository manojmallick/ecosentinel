const crypto = require("crypto");

const DEFAULT_LOCATION = "us-central1";
const DEFAULT_MODEL = "gemini-2.0-flash-001";
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken = null;

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseServiceAccountJson({
  serviceAccountJson = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON,
  serviceAccountJsonBase64 = process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64
} = {}) {
  const rawJson = serviceAccountJsonBase64
    ? Buffer.from(serviceAccountJsonBase64, "base64").toString("utf8")
    : serviceAccountJson;

  if (!rawJson) {
    throw new Error("GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is required for Vertex Gemini");
  }

  const parsed = JSON.parse(rawJson);

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Vertex service account JSON must include client_email and private_key");
  }

  return parsed;
}

function buildJwtAssertion({
  now = Math.floor(Date.now() / 1000),
  serviceAccount,
  scope = DEFAULT_SCOPE,
  tokenUrl = GOOGLE_TOKEN_URL
}) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const payload = {
    aud: tokenUrl,
    exp: now + 3600,
    iat: now,
    iss: serviceAccount.client_email,
    scope
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");

  signer.update(unsignedJwt);
  signer.end();

  return `${unsignedJwt}.${signer.sign(serviceAccount.private_key, "base64url")}`;
}

async function fetchAccessToken({
  fetchImpl = fetch,
  serviceAccount = parseServiceAccountJson(),
  tokenUrl = GOOGLE_TOKEN_URL
} = {}) {
  const nowMs = Date.now();

  if (cachedToken && cachedToken.expiresAt > nowMs + 60_000) {
    return cachedToken.accessToken;
  }

  const assertion = buildJwtAssertion({
    serviceAccount,
    tokenUrl
  });
  const response = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
    }).toString()
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed with ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.access_token) {
    throw new Error("Google OAuth token response did not include access_token");
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: nowMs + Number(payload.expires_in ?? 3600) * 1000
  };

  return cachedToken.accessToken;
}

function buildVertexGenerateContentUrl({
  apiEndpoint = process.env.GOOGLE_VERTEX_API_ENDPOINT,
  location = process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_LOCATION,
  model = process.env.GOOGLE_VERTEX_MODEL || DEFAULT_MODEL,
  projectId = process.env.GOOGLE_CLOUD_PROJECT
} = {}) {
  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required for Vertex Gemini");
  }

  const endpoint = apiEndpoint || `https://${location}-aiplatform.googleapis.com`;
  const modelPath = `projects/${projectId}/locations/${location}/publishers/google/models/${model}`;

  return `${endpoint.replace(/\/$/, "")}/v1/${modelPath}:generateContent`;
}

function extractVertexText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim();

  if (!text) {
    throw new Error("Vertex Gemini response did not include text");
  }

  return text;
}

async function callVertexGemini({
  accessTokenProvider = fetchAccessToken,
  fetchImpl = fetch,
  location = process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_LOCATION,
  maxOutputTokens = 240,
  model = process.env.GOOGLE_VERTEX_MODEL || DEFAULT_MODEL,
  projectId = process.env.GOOGLE_CLOUD_PROJECT,
  systemPrompt,
  temperature = 0.2,
  userPrompt
}) {
  const accessToken = await accessTokenProvider();
  const response = await fetchImpl(
    buildVertexGenerateContentUrl({
      location,
      model,
      projectId
    }),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
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
          temperature
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
    throw new Error(`Vertex Gemini responded with ${response.status}`);
  }

  return extractVertexText(await response.json());
}

function hasVertexGeminiConfig(env = process.env) {
  return Boolean(
    env.GOOGLE_CLOUD_PROJECT &&
      (env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON || env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64)
  );
}

module.exports = {
  buildJwtAssertion,
  buildVertexGenerateContentUrl,
  callVertexGemini,
  extractVertexText,
  fetchAccessToken,
  hasVertexGeminiConfig,
  parseServiceAccountJson
};
