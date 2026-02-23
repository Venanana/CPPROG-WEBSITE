const DRAFT_PREFIX = "request_form_draft_";

const params = new URLSearchParams(window.location.search);
const selectedType = params.get("type");

const documentTypeSelect = document.getElementById("documentType");
const requestForm = document.getElementById("requestForm");
const successNotice = document.getElementById("successNotice");
const cancelNoticeBtn = document.getElementById("cancelNoticeBtn");
const goHomeBtn = document.getElementById("goHomeBtn");
const supportingFileInput = document.getElementById("supportingFile");
const backToDashboardBtn = document.getElementById("backToDashboardBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const clearDraftBtn = document.getElementById("clearDraftBtn");
const draftStatus = document.getElementById("draftStatus");

let settings = null;
let autosaveTimer = null;

function applyBranding(systemSettings) {
  const branding = systemSettings && systemSettings.branding ? systemSettings.branding : {};
  document.getElementById("systemTitle").textContent = branding.systemName || "BARANGAY REQUEST SYSTEM";
  document.getElementById("brandLogo").src = branding.logo || "barangay-logo.jpg";
}

function setRequiredField(inputId, labelId, baseLabel, required) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  input.required = required;
  label.textContent = `${baseLabel}${required ? " *" : ""}`;
}

function applyRequestFieldRules(systemSettings) {
  const fields = systemSettings.requestFields || {};
  setRequiredField("address", "addressLabel", "Address", !!fields.requireAddress);
  setRequiredField("contact", "contactLabel", "Contact Number", !!fields.requireContact);
  setRequiredField("purpose", "purposeLabel", "Purpose of Request", !!fields.requirePurpose);
  supportingFileInput.required = !!fields.requireAttachment;
  document.getElementById("attachmentLabel").textContent = fields.requireAttachment
    ? "Upload supporting document (required) *"
    : "Upload supporting document (optional)";
}

function renderDocumentTypes(systemSettings) {
  const types = Array.isArray(systemSettings.documentTypes) && systemSettings.documentTypes.length
    ? systemSettings.documentTypes
    : ["Barangay Clearance", "Certification of Indigency", "Barangay ID", "Certificate of Residency"];

  documentTypeSelect.innerHTML = `<option value="" selected disabled>Choose document type</option>${types.map((type) => `<option>${type}</option>`).join("")}`;
  if (selectedType && types.includes(selectedType)) {
    documentTypeSelect.value = selectedType;
  }
}

function getDraftKey() {
  const session = apiClient.getSession();
  const userId = session && session.user && session.user.id ? String(session.user.id) : "anon";
  return `${DRAFT_PREFIX}${userId}`;
}

function updateDraftStatus(message, isError) {
  if (!draftStatus) return;
  draftStatus.textContent = message;
  draftStatus.style.color = isError ? "#b3261e" : "#4b5563";
}

function collectDraftPayload() {
  return {
    documentType: documentTypeSelect.value || "",
    fullName: document.getElementById("fullName").value.trim(),
    address: document.getElementById("address").value.trim(),
    contact: document.getElementById("contact").value.trim(),
    purpose: document.getElementById("purpose").value.trim(),
    updatedAt: new Date().toISOString()
  };
}

function saveDraft(showMessage) {
  try {
    const payload = collectDraftPayload();
    localStorage.setItem(getDraftKey(), JSON.stringify(payload));
    if (showMessage) {
      const savedAt = new Date(payload.updatedAt).toLocaleString();
      updateDraftStatus(`Draft saved (${savedAt})`, false);
    }
  } catch (_err) {
    updateDraftStatus("Failed to save draft.", true);
  }
}

function clearDraft(showMessage) {
  localStorage.removeItem(getDraftKey());
  if (showMessage) updateDraftStatus("Draft cleared.", false);
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(getDraftKey());
    if (!raw) {
      updateDraftStatus("Draft not saved yet.", false);
      return;
    }

    const draft = JSON.parse(raw);
    if (!selectedType && draft.documentType) documentTypeSelect.value = draft.documentType;
    if (draft.fullName) document.getElementById("fullName").value = draft.fullName;
    if (draft.address) document.getElementById("address").value = draft.address;
    if (draft.contact) document.getElementById("contact").value = draft.contact;
    if (draft.purpose) document.getElementById("purpose").value = draft.purpose;

    const label = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : "recently";
    updateDraftStatus(`Draft restored (${label}).`, false);
  } catch (_err) {
    updateDraftStatus("Draft is invalid and could not be restored.", true);
  }
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveDraft(false), 600);
}

async function bootstrap() {
  const authUser = apiClient.requireAuth(["user"]);
  if (!authUser) return false;

  const settingsPayload = await apiClient.get("/public/settings", { auth: false });
  settings = settingsPayload.settings || {};
  applyBranding(settings);
  renderDocumentTypes(settings);
  applyRequestFieldRules(settings);

  try {
    const me = await apiClient.get("/users/me");
    const user = me.user || {};
    if (user.fullName) document.getElementById("fullName").value = user.fullName;
    if (user.address) document.getElementById("address").value = user.address;
    if (user.contact) document.getElementById("contact").value = user.contact;
  } catch (_err) {
    // profile prefill is optional
  }

  restoreDraft();
  return true;
}

cancelNoticeBtn.addEventListener("click", function () {
  successNotice.classList.remove("show");
});

goHomeBtn.addEventListener("click", function () {
  window.location.href = "landingpage.html";
});

if (backToDashboardBtn) {
  backToDashboardBtn.addEventListener("click", function () {
    window.location.href = "landingpage.html";
  });
}

if (saveDraftBtn) {
  saveDraftBtn.addEventListener("click", function () {
    saveDraft(true);
  });
}

if (clearDraftBtn) {
  clearDraftBtn.addEventListener("click", function () {
    const shouldClear = window.confirm("Clear your saved draft for this form?");
    if (!shouldClear) return;
    clearDraft(true);
  });
}

[documentTypeSelect, document.getElementById("fullName"), document.getElementById("address"), document.getElementById("contact"), document.getElementById("purpose")]
  .forEach((field) => {
    if (!field) return;
    field.addEventListener("input", scheduleAutosave);
    field.addEventListener("change", scheduleAutosave);
  });

window.addEventListener("beforeunload", function () {
  saveDraft(false);
});

requestForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const payload = {
    type: documentTypeSelect.value,
    purpose: document.getElementById("purpose").value.trim(),
    address: document.getElementById("address").value.trim(),
    contact: document.getElementById("contact").value.trim()
  };

  try {
    await apiClient.post("/requests", payload);
    clearDraft(false);
    updateDraftStatus("Draft cleared after successful submission.", false);
    successNotice.classList.add("show");
  } catch (err) {
    window.alert(err.message || "Failed to submit request.");
  }
});

bootstrap().catch((err) => {
  window.alert(err.message || "Could not load request form.");
});
