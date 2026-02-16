const bcrypt = require("bcryptjs");
const asyncHandler = require("../utils/asyncHandler");
const { query } = require("../config/db");

const ALLOWED_STATUSES = new Set(["Pending", "Approved", "Rejected", "Cancelled"]);

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

function normalizeSettings(row) {
  return {
    branding: {
      systemName: row.system_name,
      logo: row.logo_url,
      adminSubtitle: row.admin_subtitle,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone
    },
    requestFields: row.request_rules || {},
    workflow: row.workflow || {},
    documentTypes: Array.isArray(row.document_types) ? row.document_types : []
  };
}

async function getCurrentSettingsRow() {
  const settingsResult = await query(`SELECT * FROM settings WHERE id = 1 LIMIT 1`);
  if (settingsResult.rowCount) return settingsResult.rows[0];

  const inserted = await query(
    `INSERT INTO settings (id, system_name, logo_url, admin_subtitle)
     VALUES (1, 'BARANGAY REQUEST SYSTEM', 'barangay-logo.jpg', 'Admin Request Management')
     RETURNING *`
  );
  return inserted.rows[0];
}

const getRequests = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const type = String(req.query.type || "").trim();
  const status = String(req.query.status || "").trim();
  const date = String(req.query.date || "").trim();
  const limit = Math.min(Number(req.query.limit || 30), 100);
  const page = Math.max(Number(req.query.page || 1), 1);
  const offset = (page - 1) * limit;

  const where = ["1=1"];
  const values = [];
  let idx = 1;

  if (q) {
    where.push(`(
      LOWER(u.full_name) LIKE $${idx} OR
      LOWER(u.username) LIKE $${idx} OR
      LOWER(r.type) LIKE $${idx} OR
      LOWER(COALESCE(r.purpose, '')) LIKE $${idx} OR
      LOWER(COALESCE(r.contact, '')) LIKE $${idx}
    )`);
    values.push(`%${q}%`);
    idx += 1;
  }
  if (type) {
    where.push(`r.type = $${idx}`);
    values.push(type);
    idx += 1;
  }
  if (status) {
    where.push(`r.status = $${idx}`);
    values.push(status);
    idx += 1;
  }
  if (date) {
    where.push(`DATE(r.submitted_at) = $${idx}`);
    values.push(date);
    idx += 1;
  }

  values.push(limit, offset);

  const rows = await query(
    `SELECT
       r.id,
       r.type,
       r.purpose,
       r.address,
       r.contact,
       r.status,
       r.submitted_at,
       r.updated_at,
       u.id AS user_id,
       u.username,
       u.full_name,
       u.email
     FROM requests r
     JOIN users u ON u.id = r.user_id
     WHERE ${where.join(" AND ")}
     ORDER BY r.submitted_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  return res.json({
    requests: rows.rows.map((item) => ({
      id: item.id,
      user: item.full_name,
      username: item.username,
      email: item.email,
      userId: item.user_id,
      type: item.type,
      purpose: item.purpose,
      address: item.address,
      contact: item.contact,
      status: item.status,
      date: item.submitted_at ? new Date(item.submitted_at).toISOString().slice(0, 10) : null,
      submittedAt: item.submitted_at,
      updatedAt: item.updated_at
    }))
  });
});

const updateRequestStatus = asyncHandler(async (req, res) => {
  const requestId = Number(req.params.id);
  const nextStatus = String(req.body?.status || "").trim();

  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw badRequest("Invalid request id");
  }
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    throw badRequest("Invalid status value");
  }

  const requestResult = await query(
    `SELECT r.id, r.user_id, r.type, r.status
     FROM requests r
     WHERE r.id = $1
     LIMIT 1`,
    [requestId]
  );
  if (!requestResult.rowCount) throw notFound("Request not found");

  const current = requestResult.rows[0];

  const settingsRow = await getCurrentSettingsRow();
  const workflow = settingsRow.workflow || {};
  const allowResetToPending = Boolean(workflow.allowResetToPending);
  if (nextStatus === "Pending" && current.status !== "Pending" && !allowResetToPending) {
    throw badRequest("Workflow does not allow resetting requests back to pending");
  }

  if (current.status === nextStatus) {
    return res.json({
      request: {
        id: current.id,
        status: current.status,
        type: current.type,
        userId: current.user_id
      }
    });
  }

  const updated = await query(
    `UPDATE requests
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, user_id, type, status, submitted_at, updated_at`,
    [nextStatus, requestId]
  );

  const row = updated.rows[0];

  await query(
    `INSERT INTO notifications (user_id, message)
     VALUES ($1, $2)`,
    [row.user_id, `Your ${row.type} request is now ${row.status}.`]
  );

  await query(
    `INSERT INTO activity_logs (actor_user_id, action, target_type, target_id)
     VALUES ($1, $2, 'request', $3)`,
    [req.auth.userId, `Updated request ${requestId} to ${row.status}`, String(requestId)]
  );

  return res.json({
    request: {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      status: row.status,
      date: new Date(row.submitted_at).toISOString().slice(0, 10),
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at
    }
  });
});

const getResidents = asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT id, username, email, full_name, contact, address, dob, created_at
     FROM users
     WHERE role = 'user'
     ORDER BY created_at DESC`
  );

  return res.json({
    residents: rows.rows.map((item) => ({
      id: item.id,
      username: item.username,
      email: item.email,
      fullName: item.full_name,
      contact: item.contact,
      address: item.address,
      dob: item.dob,
      createdAt: item.created_at
    }))
  });
});

const getActivity = asyncHandler(async (_req, res) => {
  const limit = Math.min(Number(_req.query.limit || 20), 100);
  const rows = await query(
    `SELECT al.id, al.action, al.target_type, al.target_id, al.created_at, u.username AS actor_username
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.actor_user_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return res.json({
    activity: rows.rows.map((item) => ({
      id: item.id,
      message: item.action,
      actor: item.actor_username,
      targetType: item.target_type,
      targetId: item.target_id,
      date: item.created_at ? new Date(item.created_at).toISOString().slice(0, 10) : null,
      createdAt: item.created_at
    }))
  });
});

const getSettings = asyncHandler(async (_req, res) => {
  const row = await getCurrentSettingsRow();
  return res.json({ settings: normalizeSettings(row) });
});

const getAdminAccounts = asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT id, username, email, role, admin_role, created_at
     FROM users
     WHERE role = 'admin'
     ORDER BY created_at DESC`
  );

  return res.json({
    admins: rows.rows.map((item) => ({
      id: item.id,
      username: item.username,
      email: item.email,
      role: item.role,
      adminRole: item.admin_role,
      createdAt: item.created_at
    }))
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const current = await getCurrentSettingsRow();

  const nextBranding = {
    systemName: req.body?.branding?.systemName ?? current.system_name,
    logo: req.body?.branding?.logo ?? current.logo_url,
    adminSubtitle: req.body?.branding?.adminSubtitle ?? current.admin_subtitle,
    contactEmail: req.body?.branding?.contactEmail ?? current.contact_email,
    contactPhone: req.body?.branding?.contactPhone ?? current.contact_phone
  };

  const nextRequestRules = {
    ...(current.request_rules || {}),
    ...(req.body?.requestFields || {})
  };

  const nextWorkflow = {
    ...(current.workflow || {}),
    ...(req.body?.workflow || {})
  };

  const documentTypesInput = req.body?.documentTypes;
  const nextDocumentTypes = Array.isArray(documentTypesInput)
    ? documentTypesInput.map((item) => String(item).trim()).filter(Boolean)
    : (Array.isArray(current.document_types) ? current.document_types : []);

  if (!nextDocumentTypes.length) {
    throw badRequest("documentTypes must contain at least one value");
  }

  const updated = await query(
    `UPDATE settings
     SET system_name = $1,
         logo_url = $2,
         admin_subtitle = $3,
         contact_email = $4,
         contact_phone = $5,
         request_rules = $6::jsonb,
         workflow = $7::jsonb,
         document_types = $8::jsonb,
         updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    [
      nextBranding.systemName,
      nextBranding.logo,
      nextBranding.adminSubtitle,
      nextBranding.contactEmail,
      nextBranding.contactPhone,
      JSON.stringify(nextRequestRules),
      JSON.stringify(nextWorkflow),
      JSON.stringify(nextDocumentTypes)
    ]
  );

  await query(
    `INSERT INTO activity_logs (actor_user_id, action, target_type, target_id)
     VALUES ($1, $2, 'settings', '1')`,
    [_req.auth.userId, "Updated system settings"]
  );

  return res.json({ settings: normalizeSettings(updated.rows[0]) });
});

const createAdminAccount = asyncHandler(async (req, res) => {
  const { username, email, password, adminRole } = req.body || {};
  if (!username || !email || !password) {
    throw badRequest("username, email, and password are required");
  }
  if (String(password).length < 8) {
    throw badRequest("Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const inserted = await query(
      `INSERT INTO users (username, email, password_hash, role, admin_role, full_name)
       VALUES ($1, $2, $3, 'admin', $4, $5)
       RETURNING id, username, email, role, admin_role, full_name, created_at`,
      [
        String(username).trim().toLowerCase(),
        String(email).trim().toLowerCase(),
        passwordHash,
        adminRole || "Staff Admin",
        String(username).trim()
      ]
    );

    await query(
      `INSERT INTO activity_logs (actor_user_id, action, target_type, target_id)
       VALUES ($1, $2, 'user', $3)`,
      [req.auth.userId, `Created admin account ${inserted.rows[0].username}`, String(inserted.rows[0].id)]
    );

    return res.status(201).json({
      admin: {
        id: inserted.rows[0].id,
        username: inserted.rows[0].username,
        email: inserted.rows[0].email,
        role: inserted.rows[0].role,
        adminRole: inserted.rows[0].admin_role,
        fullName: inserted.rows[0].full_name,
        createdAt: inserted.rows[0].created_at
      }
    });
  } catch (err) {
    if (err.code === "23505") {
      throw badRequest("Username or email already exists");
    }
    throw err;
  }
});

const deleteAdminAccount = asyncHandler(async (req, res) => {
  const adminId = Number(req.params.id);
  if (!Number.isInteger(adminId) || adminId <= 0) {
    throw badRequest("Invalid admin id");
  }
  if (adminId === req.auth.userId) {
    throw badRequest("You cannot delete your own admin account");
  }

  const countResult = await query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`);
  const adminCount = countResult.rows[0].count;
  if (adminCount <= 1) {
    throw badRequest("At least one admin must remain");
  }

  const removed = await query(
    `DELETE FROM users
     WHERE id = $1 AND role = 'admin'
     RETURNING id, username`,
    [adminId]
  );

  if (!removed.rowCount) {
    throw notFound("Admin account not found");
  }

  await query(
    `INSERT INTO activity_logs (actor_user_id, action, target_type, target_id)
     VALUES ($1, $2, 'user', $3)`,
    [req.auth.userId, `Deleted admin account ${removed.rows[0].username}`, String(adminId)]
  );

  return res.json({ message: "Admin account deleted" });
});

module.exports = {
  getRequests,
  updateRequestStatus,
  getResidents,
  getActivity,
  getSettings,
  updateSettings,
  getAdminAccounts,
  createAdminAccount,
  deleteAdminAccount
};
