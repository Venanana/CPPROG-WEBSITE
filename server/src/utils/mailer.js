const nodemailer = require("nodemailer");
const env = require("../config/env");

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

async function sendResetCodeEmail(toEmail, code) {
  if (!hasSmtpConfig()) {
    if (env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset code for ${toEmail}: ${code}`);
    }
    return false;
  }

  const transporter = createTransport();
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: toEmail,
    subject: "Barangay Request System - Password Reset Code",
    text: `Your verification code is: ${code}. This code expires in 10 minutes.`
  });
  return true;
}

module.exports = {
  sendResetCodeEmail,
  hasSmtpConfig
};
