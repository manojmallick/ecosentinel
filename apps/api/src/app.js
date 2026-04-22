const cors = require("cors");
const express = require("express");

const { router: aqiRouter } = require("./routes/aqi");
const { router: healthRouter } = require("./routes/health");
const { router: historyRouter } = require("./routes/history");
const { router: reportRouter } = require("./routes/report");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "EcoSentinel API",
    status: "bootstrapped"
  });
});

app.use("/api/aqi", aqiRouter);
app.use("/api/history", historyRouter);
app.use("/api/health", healthRouter);
app.use("/api/report", reportRouter);

app.use((error, _req, res, next) => {
  void next;
  console.error("[api] unhandled route error", error);

  res.status(500).json({
    error: "Internal server error"
  });
});

module.exports = app;
