const { Pool } = require("pg");
const env = require("./env");

if (!env.DATABASE_URL) {
  console.warn("DATABASE_URL is missing. Configure it in server/.env");
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query
};
