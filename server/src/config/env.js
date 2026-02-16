const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 4000),
  APP_URL: process.env.APP_URL || "http://localhost:4000",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  DATABASE_URL: process.env.DATABASE_URL || "",

  JWT_SECRET: process.env.JWT_SECRET || "change-this-access-secret",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "change-this-refresh-secret",
  JWT_RESET_SECRET: process.env.JWT_RESET_SECRET || "change-this-reset-secret",
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  REFRESH_TOKEN_EXPIRES_IN_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 7),
  RESET_TOKEN_EXPIRES_IN: process.env.RESET_TOKEN_EXPIRES_IN || "10m",

  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_SECURE: toBool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "Barangay Request System <no-reply@example.com>"
};

module.exports = env;
