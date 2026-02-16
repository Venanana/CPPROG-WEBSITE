const bcrypt = require("bcryptjs");
const asyncHandler = require("../utils/asyncHandler");
const { query } = require("../config/db");

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function mapUser(row) {
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

const getMe = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, username, email, role, admin_role, full_name, contact, address, dob, avatar_url, preferences, created_at, updated_at
     FROM users WHERE id = $1 LIMIT 1`,
    [req.auth.userId]
  );
  if (!result.rowCount) throw notFound("User not found");
  return res.json({ user: mapUser(result.rows[0]) });
});

const updateMe = asyncHandler(async (req, res) => {
  const allowed = {
    fullName: "full_name",
    email: "email",
    contact: "contact",
    address: "address",
    dob: "dob",
    avatarUrl: "avatar_url"
  };

  const fields = [];
  const values = [];
  let index = 1;

  Object.entries(allowed).forEach(([inputKey, column]) => {
    if (req.body[inputKey] !== undefined) {
      fields.push(`${column} = $${index}`);
      values.push(req.body[inputKey] === "" ? null : req.body[inputKey]);
      index += 1;
    }
  });

  if (!fields.length) {
    throw badRequest("No valid fields to update");
  }

  if (req.body.email) {
    const dup = await query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1`,
      [String(req.body.email), req.auth.userId]
    );
    if (dup.rowCount) throw badRequest("Email already used by another account");
  }

  fields.push("updated_at = NOW()");
  values.push(req.auth.userId);

  const updated = await query(
    `UPDATE users SET ${fields.join(", ")}
     WHERE id = $${index}
     RETURNING id, username, email, role, admin_role, full_name, contact, address, dob, avatar_url, preferences, created_at, updated_at`,
    values
  );

  return res.json({ user: mapUser(updated.rows[0]) });
});

const updateMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    throw badRequest("currentPassword and newPassword are required");
  }
  if (String(newPassword).length < 8) {
    throw badRequest("New password must be at least 8 characters");
  }

  const found = await query(`SELECT password_hash FROM users WHERE id = $1 LIMIT 1`, [req.auth.userId]);
  if (!found.rowCount) throw notFound("User not found");

  const ok = await bcrypt.compare(String(currentPassword), found.rows[0].password_hash);
  if (!ok) throw badRequest("Current password is incorrect");

  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, req.auth.userId]);
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [req.auth.userId]);

  return res.json({ message: "Password updated" });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const inApp = Boolean(req.body?.inApp);
  const email = Boolean(req.body?.email);
  const preferences = { inApp, email };

  const updated = await query(
    `UPDATE users
     SET preferences = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, username, email, role, admin_role, full_name, contact, address, dob, avatar_url, preferences, created_at, updated_at`,
    [JSON.stringify(preferences), req.auth.userId]
  );

  return res.json({ user: mapUser(updated.rows[0]) });
});

module.exports = {
  getMe,
  updateMe,
  updateMyPassword,
  updatePreferences
};
