const asyncHandler = require("../utils/asyncHandler");
const { query } = require("../config/db");

const getMyNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const rows = await query(
    `SELECT id, message, read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [req.auth.userId, limit]
  );

  return res.json({
    notifications: rows.rows.map((item) => ({
      id: item.id,
      message: item.message,
      read: item.read,
      date: new Date(item.created_at).toISOString().slice(0, 10),
      createdAt: item.created_at
    }))
  });
});

const markAllRead = asyncHandler(async (req, res) => {
  const updated = await query(
    `UPDATE notifications
     SET read = TRUE
     WHERE user_id = $1 AND read = FALSE`,
    [req.auth.userId]
  );

  return res.json({ updated: updated.rowCount });
});

module.exports = {
  getMyNotifications,
  markAllRead
};
