const residentQuickList = document.getElementById("residentQuickList");
const residentTotalCount = document.getElementById("residentTotalCount");
const activityList = document.getElementById("adminActivityList");

let requests = [];
let residents = [];
let activity = [];
let settings = null;
const sectionIds = ["summary", "residents", "activity"];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyBranding(systemSettings) {
  const branding = systemSettings && systemSettings.branding ? systemSettings.branding : {};
  document.getElementById("systemTitle").textContent = branding.systemName || "BARANGAY REQUEST SYSTEM";
  document.getElementById("brandLogo").src = branding.logo || "barangay-logo.jpg";
}

function renderSummary() {
  const pending = requests.filter((item) => item.status === "Pending").length;
  const approved = requests.filter((item) => item.status === "Approved").length;
  const rejected = requests.filter((item) => item.status === "Rejected").length;
  const cancelled = requests.filter((item) => item.status === "Cancelled").length;

  const total = document.getElementById("totalCount");
  const pendingEl = document.getElementById("pendingCount");
  const approvedEl = document.getElementById("approvedCount");
  const rejectedEl = document.getElementById("rejectedCount");
  const cancelledEl = document.getElementById("cancelledCount");

  if (total) total.textContent = requests.length;
  if (pendingEl) pendingEl.textContent = pending;
  if (approvedEl) approvedEl.textContent = approved;
  if (rejectedEl) rejectedEl.textContent = rejected;
  if (cancelledEl) cancelledEl.textContent = cancelled;
}

function renderResidents() {
  if (residentTotalCount) residentTotalCount.textContent = residents.length;
  if (!residentQuickList) return;

  if (!residents.length) {
    residentQuickList.innerHTML = "<li class='empty'>No registered residents found.</li>";
    return;
  }

  residentQuickList.innerHTML = residents.map((item) => {
    return `
      <li>
        ${escapeHtml(item.fullName || "-")}
        <small>${escapeHtml(item.username || "-")} | ${escapeHtml(item.email || "-")} | ${escapeHtml(item.contact || "No contact")}</small>
      </li>
    `;
  }).join("");
}

function renderActivity() {
  if (!activityList) return;
  if (!activity.length) {
    activityList.innerHTML = "<li class='empty'>No activity yet.</li>";
    return;
  }

  activityList.innerHTML = activity.slice(0, 30).map((item) => `
    <li>${escapeHtml(item.message || "")}<small>${escapeHtml(item.date || "-")}</small></li>
  `).join("");
}

async function loadData() {
  const authUser = apiClient.requireAuth(["admin"]);
  if (!authUser) return false;

  const [settingsPayload, requestsPayload, residentsPayload, activityPayload] = await Promise.all([
    apiClient.get("/admin/settings"),
    apiClient.get("/admin/requests"),
    apiClient.get("/admin/residents"),
    apiClient.get("/admin/activity?limit=60")
  ]);

  settings = settingsPayload && settingsPayload.settings ? settingsPayload.settings : {};
  requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
  residents = Array.isArray(residentsPayload.residents) ? residentsPayload.residents : [];
  activity = Array.isArray(activityPayload.activity) ? activityPayload.activity : [];
  return true;
}

function renderAll() {
  applyBranding(settings || {});
  renderSummary();
  renderResidents();
  renderActivity();
  applySectionFromHash();
}

function getSectionFromHash() {
  const hash = String(window.location.hash || "").replace("#", "").trim();
  return sectionIds.includes(hash) ? hash : "summary";
}

function applySectionFromHash() {
  const active = getSectionFromHash();

  sectionIds.forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.toggle("hidden", id !== active);
  });

  document.querySelectorAll("[data-section-link]").forEach((link) => {
    const isActive = link.getAttribute("data-section-link") === active;
    link.classList.toggle("active", isActive);
  });
}

async function logoutAdmin(event) {
  if (event) event.preventDefault();
  try {
    const session = apiClient.getSession();
    if (session.refreshToken) {
      await apiClient.post("/auth/logout", { refreshToken: session.refreshToken });
    }
  } catch (_err) {
    // ignore logout failure and clear local session anyway
  } finally {
    apiClient.clearSession();
    window.location.href = "index.html";
  }
}

loadData()
  .then(function (loaded) {
    if (!loaded) return;
    renderAll();
  })
  .catch(function (err) {
    window.alert(err.message || "Failed to load admin overview.");
  });

window.addEventListener("hashchange", applySectionFromHash);
