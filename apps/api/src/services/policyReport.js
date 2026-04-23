const PDFDocument = require("pdfkit");

function summariseHistory(history, currentReading) {
  const values = history
    .map((reading) => Number(reading.aqi))
    .filter((aqi) => Number.isFinite(aqi));

  if (!values.length) {
    const fallbackAqi = Number(currentReading?.aqi ?? 0);

    return {
      averageAqi: fallbackAqi,
      maxAqi: fallbackAqi,
      minAqi: fallbackAqi,
      sampleCount: currentReading ? 1 : 0,
      trendLabel: "Limited data"
    };
  }

  const firstAqi = values[0];
  const lastAqi = values[values.length - 1];
  const delta = lastAqi - firstAqi;
  const trendLabel =
    Math.abs(delta) < 6 ? "Stable" : delta > 0 ? "Worsening" : "Improving";

  return {
    averageAqi: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    maxAqi: Math.max(...values),
    minAqi: Math.min(...values),
    sampleCount: values.length,
    trendLabel
  };
}

function summariseForecast(forecast) {
  if (!forecast?.forecast?.length) {
    return null;
  }

  const peakPoint = forecast.forecast.reduce((current, point) => {
    return point.aqi > current.aqi ? point : current;
  }, forecast.forecast[0]);

  const averageAqi = Math.round(
    forecast.forecast.reduce((sum, point) => sum + point.aqi, 0) / forecast.forecast.length
  );

  return {
    averageAqi,
    historyResolution: forecast.historyResolution,
    peakAqi: peakPoint.aqi,
    peakHour: peakPoint.hour,
    strategy: forecast.strategy,
    modelVersion: forecast.modelVersion
  };
}

function buildPolicyRecommendations({ currentReading, historySummary, forecastSummary }) {
  const recommendations = [];
  const peakAqi = Math.max(
    Number(currentReading?.aqi ?? 0),
    Number(historySummary?.maxAqi ?? 0),
    Number(forecastSummary?.peakAqi ?? 0)
  );

  if (peakAqi >= 100) {
    recommendations.push("Trigger targeted public-health messaging for schools, cyclists, and sensitive residents.");
    recommendations.push("Consider temporary traffic-calming or congestion controls near the highest exposure corridors.");
  } else if (peakAqi >= 70) {
    recommendations.push("Increase roadside monitoring and publish an advisory encouraging lower-emission commuting options.");
    recommendations.push("Coordinate with schools and employers to reduce peak-hour outdoor exposure where possible.");
  } else {
    recommendations.push("Maintain routine monitoring and keep the public dashboard updated for transparency.");
  }

  if (historySummary?.trendLabel === "Worsening") {
    recommendations.push("Escalate operational review because recent measurements show a worsening AQI trend.");
  }

  if (forecastSummary?.peakAqi && forecastSummary.peakAqi - Number(currentReading?.aqi ?? 0) >= 10) {
    recommendations.push("Prepare mitigation messaging ahead of the forecasted pollution spike later today.");
  }

  if (!forecastSummary) {
    recommendations.push("Prioritise additional data collection because forecast guidance is currently unavailable.");
  }

  return recommendations.slice(0, 4);
}

function buildPolicyReportData({
  currentReading,
  forecast,
  generatedAt = new Date().toISOString(),
  history,
  hours,
  lat,
  lng
}) {
  const historySummary = summariseHistory(history, currentReading);
  const forecastSummary = summariseForecast(forecast);

  return {
    generatedAt,
    location: {
      lat,
      lng
    },
    windowHours: hours,
    currentReading: {
      aqi: Number(currentReading.aqi),
      category: currentReading.category,
      freshness: currentReading.freshness,
      resolution: currentReading.resolution,
      source: currentReading.source,
      timestamp: currentReading.timestamp,
      pollutants: currentReading.pollutants
    },
    historySummary,
    forecastSummary,
    recommendations: buildPolicyRecommendations({
      currentReading,
      historySummary,
      forecastSummary
    })
  };
}

function collectPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    doc.on("data", (chunk) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);
  });
}

async function renderPolicyReportPdf(reportData, { PdfDocument = PDFDocument } = {}) {
  const doc = new PdfDocument({
    margin: 50,
    size: "A4"
  });
  const bufferPromise = collectPdfBuffer(doc);

  doc.fontSize(23).text("EcoSentinel Policy Air Quality Report", {
    align: "left"
  });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#475569").text(`Generated ${new Date(reportData.generatedAt).toLocaleString("en-GB")}`);
  doc.text(`Location: ${reportData.location.lat.toFixed(4)}, ${reportData.location.lng.toFixed(4)}`);
  doc.text(`Analysis window: ${reportData.windowHours} hours`);

  doc.moveDown(1.2);
  doc.fillColor("#0f172a").fontSize(16).text("Current conditions");
  doc.moveDown(0.4);
  doc.fontSize(11).text(`Current AQI: ${reportData.currentReading.aqi} (${reportData.currentReading.category})`);
  doc.text(`Location match: ${reportData.currentReading.resolution || "local"}`);
  doc.text(`Latest source: ${reportData.currentReading.source}`);
  doc.text(`Freshness: ${reportData.currentReading.freshness || "current"}`);
  doc.text(`Recorded at: ${new Date(reportData.currentReading.timestamp).toLocaleString("en-GB")}`);
  doc.text(
    `Pollutants: PM2.5 ${reportData.currentReading.pollutants.pm25 ?? "-"}, PM10 ${reportData.currentReading.pollutants.pm10 ?? "-"}, NO2 ${reportData.currentReading.pollutants.no2 ?? "-"}, O3 ${reportData.currentReading.pollutants.o3 ?? "-"}`
  );

  doc.moveDown(1);
  doc.fontSize(16).text("Observed history summary");
  doc.moveDown(0.4);
  doc.fontSize(11).text(`Average AQI: ${reportData.historySummary.averageAqi}`);
  doc.text(`Range: ${reportData.historySummary.minAqi} to ${reportData.historySummary.maxAqi}`);
  doc.text(`Trend: ${reportData.historySummary.trendLabel}`);
  doc.text(`Samples analysed: ${reportData.historySummary.sampleCount}`);

  doc.moveDown(1);
  doc.fontSize(16).text("Forecast outlook");
  doc.moveDown(0.4);

  if (reportData.forecastSummary) {
    doc.fontSize(11).text(`Peak forecast AQI: ${reportData.forecastSummary.peakAqi} at hour ${reportData.forecastSummary.peakHour}`);
    doc.text(`Average forecast AQI: ${reportData.forecastSummary.averageAqi}`);
    doc.text(`Forecast strategy: ${reportData.forecastSummary.strategy}`);
    doc.text(`History resolution: ${reportData.forecastSummary.historyResolution || "local"}`);
    doc.text(`Model version: ${reportData.forecastSummary.modelVersion}`);
  } else {
    doc.fontSize(11).text("Forecast unavailable: the report was generated from current and historical measurements only.");
  }

  doc.moveDown(1);
  doc.fontSize(16).text("Policy actions");
  doc.moveDown(0.5);
  doc.fontSize(11);
  reportData.recommendations.forEach((recommendation, index) => {
    doc.text(`${index + 1}. ${recommendation}`, {
      indent: 12
    });
    doc.moveDown(0.35);
  });

  doc.moveDown(0.7);
  doc.fillColor("#475569").fontSize(9).text(
    "Prepared by EcoSentinel for policy and NGO stakeholders. Use alongside local public-health and transport guidance."
  );

  doc.end();

  return bufferPromise;
}

module.exports = {
  buildPolicyRecommendations,
  buildPolicyReportData,
  renderPolicyReportPdf,
  summariseForecast,
  summariseHistory
};
