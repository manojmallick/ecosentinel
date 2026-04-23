const BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const DEFAULT_TIMEOUT_MS = 10000;

function buildOpenMeteoUrl(lat, lng) {
  const url = new URL(BASE_URL);

  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    "pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
  );
  url.searchParams.set("timezone", "GMT");

  return url;
}

async function getCurrentAirQuality(lat, lng) {
  if (typeof fetch !== "function") {
    console.error("[Open-Meteo] Fetch API is unavailable in this runtime");
    return null;
  }

  try {
    const response = await fetch(buildOpenMeteoUrl(lat, lng), {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo responded with ${response.status}`);
    }

    const payload = await response.json();
    const current = payload?.current;

    if (!current) {
      return null;
    }

    return {
      lat: Number(payload?.latitude ?? lat),
      lng: Number(payload?.longitude ?? lng),
      pollutants: {
        pm25: Number.isFinite(Number(current.pm2_5)) ? Number(current.pm2_5) : null,
        pm10: Number.isFinite(Number(current.pm10)) ? Number(current.pm10) : null,
        no2: Number.isFinite(Number(current.nitrogen_dioxide)) ? Number(current.nitrogen_dioxide) : null,
        o3: Number.isFinite(Number(current.ozone)) ? Number(current.ozone) : null,
        co: Number.isFinite(Number(current.carbon_monoxide)) ? Number(current.carbon_monoxide) : null,
        so2: Number.isFinite(Number(current.sulphur_dioxide)) ? Number(current.sulphur_dioxide) : null
      },
      recorded_at: current.time || new Date().toISOString()
    };
  } catch (error) {
    console.error("[Open-Meteo] Fetch error:", error.message);
    return null;
  }
}

module.exports = {
  getCurrentAirQuality
};
