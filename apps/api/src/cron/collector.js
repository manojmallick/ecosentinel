const cron = require("node-cron");

const { collect } = require("../agents/DataCollectorAgent");

function startCollector() {
  const task = cron.schedule("*/15 * * * *", async () => {
    try {
      await collect();
    } catch (error) {
      console.error("[Cron] Collection error:", error);
    }
  });

  collect().catch((error) => {
    console.error("[Cron] Initial collection error:", error);
  });

  console.log("[Cron] DataCollector scheduled: every 15 minutes");
  return task;
}

module.exports = {
  startCollector
};
