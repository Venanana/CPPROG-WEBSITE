const asyncHandler = require("../utils/asyncHandler");
const { query } = require("../config/db");

const getSettings = asyncHandler(async (_req, res) => {
  const result = await query(`SELECT * FROM settings WHERE id = 1 LIMIT 1`);

  if (!result.rowCount) {
    const inserted = await query(
      `INSERT INTO settings (id, system_name, logo_url, admin_subtitle)
       VALUES (1, 'BARANGAY REQUEST SYSTEM', 'barangay-logo.jpg', 'Admin Request Management')
       RETURNING *`
    );
    return res.json({
      settings: {
        branding: {
          systemName: inserted.rows[0].system_name,
          logo: inserted.rows[0].logo_url,
          adminSubtitle: inserted.rows[0].admin_subtitle,
          contactEmail: inserted.rows[0].contact_email,
          contactPhone: inserted.rows[0].contact_phone
        },
        requestFields: inserted.rows[0].request_rules || {},
        workflow: inserted.rows[0].workflow || {},
        documentTypes: Array.isArray(inserted.rows[0].document_types) ? inserted.rows[0].document_types : []
      }
    });
  }

  const row = result.rows[0];
  return res.json({
    settings: {
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
    }
  });
});

module.exports = {
  getSettings
};
