const BASE_URL = "https://api.airvisual.com/v2/nearest_city";
const DEFAULT_TIMEOUT_MS = 10000;

function buildIQAirUrl(lat, lng) {
  const url = new URL(BASE_URL);

  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("key", process.env.IQAIR_API_KEY || "");

  return url;
}

async function getNearestCity(lat, lng) {
  if (!process.env.IQAIR_API_KEY) {
    return null;
  }

  if (typeof fetch !== "function") {
    console.error("[IQAir] Fetch API is unavailable in this runtime");
    return null;
  }

  try {
    const response = await fetch(buildIQAirUrl(lat, lng), {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`IQAir responded with ${response.status}`);
    }

    const payload = await response.json();
    return payload.data || null;
  } catch (error) {
    console.error("[IQAir] Fetch error:", error.message);
    return null;
  }
}

module.exports = {
  getNearestCity
};
