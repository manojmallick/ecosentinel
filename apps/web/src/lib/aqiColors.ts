export type AqiBand = {
  color: string;
  label: string;
  max: number;
  pulse: string;
};

export const AQI_BANDS: AqiBand[] = [
  { max: 50, label: "Good", color: "#22c55e", pulse: "rgba(34, 197, 94, 0.28)" },
  { max: 100, label: "Moderate", color: "#facc15", pulse: "rgba(250, 204, 21, 0.28)" },
  { max: 150, label: "USG", color: "#f97316", pulse: "rgba(249, 115, 22, 0.28)" },
  { max: 200, label: "Unhealthy", color: "#ef4444", pulse: "rgba(239, 68, 68, 0.3)" },
  { max: 300, label: "Very Unhealthy", color: "#a855f7", pulse: "rgba(168, 85, 247, 0.32)" },
  { max: 500, label: "Hazardous", color: "#991b1b", pulse: "rgba(153, 27, 27, 0.34)" }
];

export function getAqiBand(aqi: number): AqiBand {
  return AQI_BANDS.find((band) => aqi <= band.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
}

export function formatPollutant(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(1);
}

export function describeAqi(aqi: number): string {
  const band = getAqiBand(aqi);
  return `${band.label} air (${aqi} AQI)`;
}
