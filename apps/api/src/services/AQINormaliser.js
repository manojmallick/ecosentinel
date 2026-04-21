/**
 * US EPA AQI Calculation
 * Formula: AQI = ((Ih - Il) / (Ch - Cl)) * (Cp - Cl) + Il
 * where Ih/Il = AQI breakpoints, Ch/Cl = concentration breakpoints, Cp = measured concentration.
 */

const BREAKPOINTS = {
  pm25: [
    { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 }
  ],
  pm10: [
    { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
    { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
    { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
    { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
    { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
    { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 }
  ],
  no2: [
    { cLow: 0, cHigh: 53, iLow: 0, iHigh: 50 },
    { cLow: 54, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 101, cHigh: 360, iLow: 101, iHigh: 150 },
    { cLow: 361, cHigh: 649, iLow: 151, iHigh: 200 },
    { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
    { cLow: 1250, cHigh: 2049, iLow: 301, iHigh: 500 }
  ],
  o3: [
    { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
    { cLow: 55, cHigh: 70, iLow: 51, iHigh: 100 },
    { cLow: 71, cHigh: 85, iLow: 101, iHigh: 150 },
    { cLow: 86, cHigh: 105, iLow: 151, iHigh: 200 },
    { cLow: 106, cHigh: 200, iLow: 201, iHigh: 300 }
  ]
};

const CATEGORIES = [
  { max: 50, label: "Good", color: "#00e400" },
  { max: 100, label: "Moderate", color: "#ffff00" },
  { max: 150, label: "USG", color: "#ff7e00" },
  { max: 200, label: "Unhealthy", color: "#ff0000" },
  { max: 300, label: "Very Unhealthy", color: "#8f3f97" },
  { max: 500, label: "Hazardous", color: "#7e0023" }
];

function calculateAQI(concentration, pollutant) {
  const breakpoints = BREAKPOINTS[pollutant];

  if (!breakpoints || concentration == null || Number.isNaN(Number(concentration))) {
    return null;
  }

  const numericConcentration = Number(concentration);
  const matchingBreakpoint = breakpoints.find((breakpoint) => {
    return numericConcentration >= breakpoint.cLow && numericConcentration <= breakpoint.cHigh;
  });

  if (!matchingBreakpoint) {
    return numericConcentration > 500 ? 500 : 0;
  }

  return Math.round(
    ((matchingBreakpoint.iHigh - matchingBreakpoint.iLow) /
      (matchingBreakpoint.cHigh - matchingBreakpoint.cLow)) *
      (numericConcentration - matchingBreakpoint.cLow) +
      matchingBreakpoint.iLow
  );
}

function aqiToCategory(aqi) {
  const match = CATEGORIES.find((category) => aqi <= category.max);
  return match ? match.label : "Hazardous";
}

function aqiToColor(aqi) {
  const match = CATEGORIES.find((category) => aqi <= category.max);
  return match ? match.color : "#7e0023";
}

function calculateFromPollutants({ pm25, pm10, no2, o3 }) {
  const pollutantScores = [
    pm25 != null ? calculateAQI(pm25, "pm25") : null,
    pm10 != null ? calculateAQI(pm10, "pm10") : null,
    no2 != null ? calculateAQI(no2, "no2") : null,
    o3 != null ? calculateAQI(o3, "o3") : null
  ].filter((value) => value != null);

  if (pollutantScores.length === 0) {
    return {
      aqi: 0,
      category: "Good",
      color: "#00e400"
    };
  }

  const aqi = Math.max(...pollutantScores);

  return {
    aqi,
    category: aqiToCategory(aqi),
    color: aqiToColor(aqi)
  };
}

module.exports = {
  calculateAQI,
  calculateFromPollutants,
  aqiToCategory,
  aqiToColor
};
