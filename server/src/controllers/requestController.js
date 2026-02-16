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

function mapRequest(row) {
  return {
    id: row.id,
    type: row.type,
    purpose: row.purpose,
    address: row.address,
    contact: row.contact,
    status: row.status,
    date: row.submitted_at ? new Date(row.submitted_at).toISOString().slice(0, 10) : null,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at
  };
}

const getMyRequests = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, type, purpose, address, contact, status, submitted_at, updated_at
     FROM requests
     WHERE user_id = $1
     ORDER BY submitted_at DESC`,
    [req.auth.userId]
  );

  return res.json({ requests: result.rows.map(mapRequest) });
});

const createRequest = asyncHandler(async (req, res) => {
  const { type, purpose, address, contact } = req.body || {};
  if (!type) throw badRequest("type is required");

  const created = await query(
    `INSERT INTO requests (user_id, type, purpose, address, contact, status)
     VALUES ($1, $2, $3, $4, $5, 'Pending')
     RETURNING id, type, purpose, address, contact, status, submitted_at, updated_at`,
    [req.auth.userId, String(type).trim(), purpose || null, address || null, contact || null]
  );

  await query(
    `INSERT INTO notifications (user_id, message)
     VALUES ($1, $2)`,
    [req.auth.userId, `Your ${type} request was submitted.`]
  );

  await query(
    `INSERT INTO activity_logs (actor_user_id, action, target_type, target_id)
     VALUES ($1, $2, 'request', $3)`,
    [req.auth.userId, `Submitted ${type} request`, String(created.rows[0].id)]
  );

  return res.status(201).json({ request: mapRequest(created.rows[0]) });
});

const cancelRequest = asyncHandler(async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw badRequest("Invalid request id");
  }

  const updated = await query(
    `UPDATE requests
     SET status = 'Cancelled', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'Pending'
     RETURNING id, type, purpose, address, contact, status, submitted_at, updated_at`,
    [requestId, req.auth.userId]
  );

  if (!updated.rowCount) {
    throw notFound("Pending request not found");
  }

  await query(
    `INSERT INTO notifications (user_id, message)
     VALUES ($1, $2)`,
    [req.auth.userId, `Your ${updated.rows[0].type} request was cancelled.`]
  );

  await query(
    `INSERT INTO activity_logs (actor_user_id, action, target_type, target_id)
     VALUES ($1, $2, 'request', $3)`,
    [req.auth.userId, `Cancelled ${updated.rows[0].type} request`, String(requestId)]
  );

  return res.json({ request: mapRequest(updated.rows[0]) });
});

const clearNonPending = asyncHandler(async (req, res) => {
  const deleted = await query(
    `DELETE FROM requests
     WHERE user_id = $1 AND status <> 'Pending'
     RETURNING id`,
    [req.auth.userId]
  );

  if (deleted.rowCount > 0) {
    await query(
      `INSERT INTO activity_logs (actor_user_id, action, target_type, target_id)
       VALUES ($1, $2, 'request', $3)`,
      [req.auth.userId, `Cleared ${deleted.rowCount} non-pending requests`, `count:${deleted.rowCount}`]
    );
  }

  return res.json({ cleared: deleted.rowCount });
});

const getReceipt = asyncHandler(async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw badRequest("Invalid request id");
  }

  const result = await query(
    `SELECT r.id, r.type, r.purpose, r.status, r.submitted_at, u.full_name
     FROM requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1 AND r.user_id = $2
     LIMIT 1`,
    [requestId, req.auth.userId]
  );

  if (!result.rowCount) {
    throw notFound("Request not found");
  }

  const row = result.rows[0];
  const lines = [
    "BARANGAY REQUEST SYSTEM RECEIPT",
    "----------------------------------------",
    `Resident: ${row.full_name}`,
    `Request ID: ${row.id}`,
    `Document Type: ${row.type}`,
    `Status: ${row.status}`,
    `Submitted Date: ${new Date(row.submitted_at).toISOString()}`,
    `Purpose: ${row.purpose || "-"}`,
    "----------------------------------------"
  ];

  res.type("text/plain");
  return res.send(lines.join("\n"));
});

module.exports = {
  getMyRequests,
  createRequest,
  cancelRequest,
  clearNonPending,
  getReceipt
};
