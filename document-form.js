const params = new URLSearchParams(window.location.search);
const selectedType = params.get("type");

const documentTypeSelect = document.getElementById("documentType");
const requestForm = document.getElementById("requestForm");
const successNotice = document.getElementById("successNotice");
const cancelNoticeBtn = document.getElementById("cancelNoticeBtn");
const goHomeBtn = document.getElementById("goHomeBtn");
const supportingFileInput = document.getElementById("supportingFile");

let settings = null;

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

  documentTypeSelect.innerHTML = `<option value="" selected disabled>Choose document type</option>${types.map(type => `<option>${type}</option>`).join("")}`;
  if (selectedType && types.includes(selectedType)) {
    documentTypeSelect.value = selectedType;
  }
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

  return true;
}

cancelNoticeBtn.addEventListener("click", function () {
  successNotice.classList.remove("show");
});

goHomeBtn.addEventListener("click", function () {
  window.location.href = "landingpage.html";
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
    successNotice.classList.add("show");
  } catch (err) {
    window.alert(err.message || "Failed to submit request.");
  }
});

bootstrap().catch((err) => {
  window.alert(err.message || "Could not load request form.");
});
