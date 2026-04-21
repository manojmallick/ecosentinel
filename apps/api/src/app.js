const cors = require("cors");
const express = require("express");

const { router: healthRouter } = require("./routes/health");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "EcoSentinel API",
    status: "bootstrapped"
  });
});

app.use("/api/health", healthRouter);

module.exports = app;
