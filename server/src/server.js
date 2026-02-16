const app = require("./app");
const env = require("./config/env");
const { query } = require("./config/db");

async function start() {
  await query("SELECT 1");
  app.listen(env.PORT, () => {
    console.log(`API listening on ${env.APP_URL || `http://localhost:${env.PORT}`}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
