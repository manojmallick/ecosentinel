const BASE_URL = "https://api.openaq.org/v3";
const DEFAULT_TIMEOUT_MS = 10000;
const POLLUTANTS = ["pm25", "pm10", "no2", "o3"];

function buildOpenAQUrl(lat, lng, radiusKm) {
  const url = new URL(`${BASE_URL}/locations`);

  url.searchParams.set("coordinates", `${lat},${lng}`);
  url.searchParams.set("radius", String(radiusKm * 1000));
  url.searchParams.set("limit", "20");

  for (const pollutant of POLLUTANTS) {
    url.searchParams.append("parameters", pollutant);
  }

  return url;
}

async function getLatestReadings(lat, lng, radiusKm = 25) {
  if (typeof fetch !== "function") {
    console.error("[OpenAQ] Fetch API is unavailable in this runtime");
    return [];
  }

  const headers = {};
  if (process.env.OPENAQ_API_KEY) {
    headers["X-API-Key"] = process.env.OPENAQ_API_KEY;
  }

  try {
    const response = await fetch(buildOpenAQUrl(lat, lng, radiusKm), {
      headers,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`OpenAQ responded with ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload.results) ? payload.results : [];
  } catch (error) {
    console.error("[OpenAQ] Fetch error:", error.message);
    return [];
  }
}

module.exports = {
  getLatestReadings
};
