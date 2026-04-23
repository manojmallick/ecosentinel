require("dotenv").config();

const app = require("./app");
const { startCollector } = require("./cron/collector");

const port = Number(process.env.PORT || 3001);
const shouldStartCollector = process.env.ENABLE_COLLECTOR !== "false";

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);

  if (shouldStartCollector) {
    startCollector();
  } else {
    console.log("[Cron] DataCollector disabled via ENABLE_COLLECTOR=false");
  }
});
