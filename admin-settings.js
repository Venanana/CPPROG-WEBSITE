let settings = null;
let admins = [];

function defaultSettings() {
  return {
    branding: {
      systemName: "BARANGAY REQUEST SYSTEM",
      logo: "barangay-logo.jpg",
      adminSubtitle: "Admin Request Management",
      contactEmail: "",
      contactPhone: ""
    },
    documentTypes: [
      "Barangay Clearance",
      "Certification of Indigency",
      "Barangay ID",
      "Certificate of Residency"
    ],
    requestFields: {
      requireAddress: true,
      requireContact: true,
      requirePurpose: true,
      requireAttachment: false
    },
    workflow: {
      allowResetToPending: true
    }
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showStatus(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `status ${type || ""}`.trim();
}

function applyBrandingPreview() {
  document.getElementById("systemTitle").textContent = settings.branding.systemName || "BARANGAY REQUEST SYSTEM";
  document.getElementById("brandLogo").src = settings.branding.logo || "barangay-logo.jpg";
}

function fillBrandingForm() {
  document.getElementById("brandingSystemName").value = settings.branding.systemName || "";
  document.getElementById("brandingSubtitle").value = settings.branding.adminSubtitle || "";
  document.getElementById("brandingLogo").value = settings.branding.logo || "";
  document.getElementById("brandingEmail").value = settings.branding.contactEmail || "";
  document.getElementById("brandingPhone").value = settings.branding.contactPhone || "";
}

function renderDocTypes() {
  const list = document.getElementById("docTypeList");
  if (!settings.documentTypes.length) {
    list.innerHTML = "<li class='empty'>No document types configured.</li>";
    return;
  }
  list.innerHTML = settings.documentTypes.map(type => `
    <li>
      <span>${escapeHtml(type)}</span>
      <button type="button" class="remove-pill" data-type="${escapeHtml(type)}">Remove</button>
    </li>
  `).join("");
}

function fillRulesForm() {
  document.getElementById("requireAddress").checked = !!settings.requestFields.requireAddress;
  document.getElementById("requireContact").checked = !!settings.requestFields.requireContact;
  document.getElementById("requirePurpose").checked = !!settings.requestFields.requirePurpose;
  document.getElementById("requireAttachment").checked = !!settings.requestFields.requireAttachment;
}

function fillWorkflowForm() {
  document.getElementById("allowResetToPending").checked = !!settings.workflow.allowResetToPending;
}

function renderAdminTable() {
  const body = document.getElementById("adminTableBody");
  if (!admins.length) {
    body.innerHTML = "<tr><td colspan='4' class='empty'>No admin accounts found.</td></tr>";
    return;
  }
  body.innerHTML = admins.map(item => `
    <tr>
      <td>${escapeHtml(item.username)}</td>
      <td>${escapeHtml(item.adminRole || "Admin")}</td>
      <td>${escapeHtml(String(item.createdAt || "-").slice(0, 10))}</td>
      <td><button type="button" class="delete-btn" data-id="${escapeHtml(item.id)}">Delete</button></td>
    </tr>
  `).join("");
}

async function persistSettings() {
  const payload = await apiClient.patch("/admin/settings", settings);
  settings = payload.settings || settings;
}

async function onSaveBranding(event) {
  event.preventDefault();
  settings.branding.systemName = document.getElementById("brandingSystemName").value.trim() || "BARANGAY REQUEST SYSTEM";
  settings.branding.adminSubtitle = document.getElementById("brandingSubtitle").value.trim() || "Admin Request Management";
  settings.branding.logo = document.getElementById("brandingLogo").value.trim() || "barangay-logo.jpg";
  settings.branding.contactEmail = document.getElementById("brandingEmail").value.trim();
  settings.branding.contactPhone = document.getElementById("brandingPhone").value.trim();

  try {
    await persistSettings();
    applyBrandingPreview();
    showStatus("brandingStatus", "Branding settings saved.", "success");
  } catch (err) {
    showStatus("brandingStatus", err.message || "Failed to save branding.", "error");
  }
}

async function onAddDocType() {
  const input = document.getElementById("newDocType");
  const value = input.value.trim();
  if (!value) {
    showStatus("docTypeStatus", "Enter a document type name first.", "error");
    return;
  }
  if (settings.documentTypes.some(item => item.toLowerCase() === value.toLowerCase())) {
    showStatus("docTypeStatus", "Document type already exists.", "error");
    return;
  }

  settings.documentTypes.push(value);
  try {
    await persistSettings();
    renderDocTypes();
    input.value = "";
    showStatus("docTypeStatus", "Document type added.", "success");
  } catch (err) {
    showStatus("docTypeStatus", err.message || "Failed to add document type.", "error");
  }
}

async function onSaveRules(event) {
  event.preventDefault();
  settings.requestFields = {
    requireAddress: document.getElementById("requireAddress").checked,
    requireContact: document.getElementById("requireContact").checked,
    requirePurpose: document.getElementById("requirePurpose").checked,
    requireAttachment: document.getElementById("requireAttachment").checked
  };

  try {
    await persistSettings();
    showStatus("rulesStatus", "Request field rules saved.", "success");
  } catch (err) {
    showStatus("rulesStatus", err.message || "Failed to save rules.", "error");
  }
}

async function onSaveWorkflow(event) {
  event.preventDefault();
  settings.workflow.allowResetToPending = document.getElementById("allowResetToPending").checked;

  try {
    await persistSettings();
    showStatus("workflowStatus", "Workflow settings saved.", "success");
  } catch (err) {
    showStatus("workflowStatus", err.message || "Failed to save workflow.", "error");
  }
}

async function onAddAdmin(event) {
  event.preventDefault();
  const username = document.getElementById("adminUsernameInput").value.trim().toLowerCase();
  const password = document.getElementById("adminPasswordInput").value;
  const adminRole = document.getElementById("adminRoleInput").value;

  if (!username || !password) {
    showStatus("adminStatus", "Username and password are required.", "error");
    return;
  }

  try {
    await apiClient.post("/admin/accounts", {
      username,
      email: `${username}@barangay.local`,
      password,
      adminRole
    });
    const adminsPayload = await apiClient.get("/admin/accounts");
    admins = Array.isArray(adminsPayload.admins) ? adminsPayload.admins : admins;
    renderAdminTable();
    document.getElementById("adminAccountForm").reset();
    showStatus("adminStatus", "Admin account added.", "success");
  } catch (err) {
    showStatus("adminStatus", err.message || "Failed to add admin account.", "error");
  }
}

document.getElementById("brandingForm").addEventListener("submit", onSaveBranding);
document.getElementById("addDocTypeBtn").addEventListener("click", onAddDocType);
document.getElementById("rulesForm").addEventListener("submit", onSaveRules);
document.getElementById("workflowForm").addEventListener("submit", onSaveWorkflow);
document.getElementById("adminAccountForm").addEventListener("submit", onAddAdmin);

document.getElementById("docTypeList").addEventListener("click", function (event) {
  const button = event.target.closest("button.remove-pill");
  if (!button) return;

  const type = String(button.getAttribute("data-type") || "");
  settings.documentTypes = settings.documentTypes.filter(item => item !== type);
  persistSettings()
    .then(function () {
      renderDocTypes();
      showStatus("docTypeStatus", "Document type removed.", "success");
    })
    .catch(function (err) {
      showStatus("docTypeStatus", err.message || "Failed to remove document type.", "error");
    });
});

document.getElementById("adminTableBody").addEventListener("click", function (event) {
  const button = event.target.closest("button.delete-btn");
  if (!button) return;
  const adminId = String(button.getAttribute("data-id") || "");

  apiClient.del(`/admin/accounts/${adminId}`)
    .then(function () {
      return apiClient.get("/admin/accounts");
    })
    .then(function (payload) {
      admins = Array.isArray(payload.admins) ? payload.admins : admins;
      renderAdminTable();
      showStatus("adminStatus", "Admin account removed.", "success");
    })
    .catch(function (err) {
      showStatus("adminStatus", err.message || "Failed to remove admin account.", "error");
    });
});

const authUser = apiClient.requireAuth(["admin"]);
if (authUser) {
  Promise.all([
    apiClient.get("/admin/settings"),
    apiClient.get("/admin/accounts")
  ])
  .then(function ([settingsPayload, adminsPayload]) {
    settings = settingsPayload.settings || defaultSettings();
    admins = Array.isArray(adminsPayload.admins) ? adminsPayload.admins : [];
    applyBrandingPreview();
    fillBrandingForm();
    fillRulesForm();
    fillWorkflowForm();
    renderDocTypes();
    renderAdminTable();
  })
  .catch(function (err) {
    window.alert(err.message || "Failed to load admin settings.");
  });
}
