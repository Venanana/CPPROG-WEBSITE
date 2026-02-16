const bcrypt = require("bcryptjs");
const asyncHandler = require("../utils/asyncHandler");
const { query } = require("../config/db");
const env = require("../config/env");
const {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
  hashToken,
  generateSixDigitCode
} = require("../utils/jwt");
const { sendResetCodeEmail } = require("../utils/mailer");

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function unauthorized(message) {
  const err = new Error(message);
  err.status = 401;
  return err;
}

function sanitizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    adminRole: row.admin_role,
    fullName: row.full_name,
    contact: row.contact,
    address: row.address,
    dob: row.dob,
    avatarUrl: row.avatar_url,
    preferences: row.preferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function persistRefreshToken(userId, refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function issueTokens(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await persistRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken };
}

const register = asyncHandler(async (req, res) => {
  const { username, email, password, fullName, contact, address, dob } = req.body || {};

  if (!username || !email || !password || !fullName) {
    throw badRequest("username, email, password, and fullName are required");
  }
  if (String(password).length < 8) {
    throw badRequest("Password must be at least 8 characters");
  }

  const existing = await query(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1`,
    [username, email]
  );
  if (existing.rowCount) {
    throw badRequest("Username or email already exists");
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  const created = await query(
    `INSERT INTO users (username, email, password_hash, full_name, contact, address, dob, role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'user')
     RETURNING id, username, email, role, admin_role, full_name, contact, address, dob, avatar_url, preferences, created_at, updated_at`,
    [String(username).trim(), String(email).trim().toLowerCase(), passwordHash, String(fullName).trim(), contact || null, address || null, dob || null]
  );

  const user = created.rows[0];
  const tokens = await issueTokens(user);
  return res.status(201).json({ user: sanitizeUser(user), ...tokens });
});

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    throw badRequest("username and password are required");
  }

  const lookupByEmail = String(username).includes("@");
  const found = await query(
    lookupByEmail
      ? `SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`
      : `SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [String(username).trim()]
  );

  if (!found.rowCount) {
    throw unauthorized("Invalid credentials");
  }

  const user = found.rows[0];
  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) {
    throw unauthorized("Invalid credentials");
  }

  const tokens = await issueTokens(user);
  return res.json({ user: sanitizeUser(user), ...tokens });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!refreshToken) {
    throw badRequest("refreshToken is required");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_err) {
    throw unauthorized("Invalid refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const valid = await query(
    `SELECT id FROM refresh_tokens
     WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > NOW()
     LIMIT 1`,
    [payload.userId, tokenHash]
  );
  if (!valid.rowCount) {
    throw unauthorized("Refresh token is expired or revoked");
  }

  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);

  const userRow = await query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [payload.userId]);
  if (!userRow.rowCount) {
    throw unauthorized("User no longer exists");
  }

  const user = userRow.rows[0];
  const tokens = await issueTokens(user);
  return res.json(tokens);
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
  }
  return res.json({ message: "Logged out" });
});

const me = asyncHandler(async (req, res) => {
  const userRow = await query(
    `SELECT id, username, email, role, admin_role, full_name, contact, address, dob, avatar_url, preferences, created_at, updated_at
     FROM users WHERE id = $1 LIMIT 1`,
    [req.auth.userId]
  );
  if (!userRow.rowCount) {
    throw unauthorized("User not found");
  }
  return res.json({ user: sanitizeUser(userRow.rows[0]) });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    throw badRequest("email is required");
  }

  const found = await query(`SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);

  if (!found.rowCount) {
    return res.json({ message: "If the email exists, a code has been sent." });
  }

  const user = found.rows[0];
  const code = generateSixDigitCode();
  const codeHash = hashToken(code);

  await query(`UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE`, [user.id]);
  await query(
    `INSERT INTO password_resets (user_id, code_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
    [user.id, codeHash]
  );

  await sendResetCodeEmail(user.email, code);

  const payload = { message: "If the email exists, a code has been sent." };
  if (env.NODE_ENV !== "production") {
    payload.debugCode = code;
  }
  return res.json(payload);
});

const verifyResetCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    throw badRequest("email and code are required");
  }

  const result = await query(
    `SELECT pr.id AS reset_id, pr.code_hash, pr.expires_at, pr.used, u.id AS user_id
     FROM users u
     JOIN password_resets pr ON pr.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     ORDER BY pr.created_at DESC
     LIMIT 1`,
    [email]
  );

  if (!result.rowCount) {
    throw badRequest("Invalid verification code");
  }

  const row = result.rows[0];
  if (row.used || new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest("Verification code expired or used");
  }

  if (hashToken(code) !== row.code_hash) {
    throw badRequest("Invalid verification code");
  }

  const resetToken = signResetToken({ userId: row.user_id, resetId: row.reset_id });
  return res.json({ resetToken });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword) {
    throw badRequest("resetToken and newPassword are required");
  }
  if (String(newPassword).length < 8) {
    throw badRequest("Password must be at least 8 characters");
  }

  let payload;
  try {
    payload = verifyResetToken(resetToken);
  } catch (_err) {
    throw badRequest("Invalid reset token");
  }

  const resetRow = await query(
    `SELECT id, user_id, expires_at, used
     FROM password_resets
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [payload.resetId, payload.userId]
  );

  if (!resetRow.rowCount) {
    throw badRequest("Reset request not found");
  }

  const row = resetRow.rows[0];
  if (row.used || new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest("Reset token expired or used");
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 10);

  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, payload.userId]);
  await query(`UPDATE password_resets SET used = TRUE WHERE id = $1`, [payload.resetId]);
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [payload.userId]);

  return res.json({ message: "Password updated successfully" });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  verifyResetCode,
  resetPassword
};
