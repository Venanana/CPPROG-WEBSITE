const residentQuickList = document.getElementById("residentQuickList");
const residentTotalCount = document.getElementById("residentTotalCount");
const activityList = document.getElementById("adminActivityList");
const historyList = document.getElementById("adminHistoryList");
const adminAvatar = document.getElementById("adminAvatar");
const adminProfileName = document.getElementById("adminProfileName");
const adminProfileRole = document.getElementById("adminProfileRole");
const adminProfileEmail = document.getElementById("adminProfileEmail");
const adminProfileUsername = document.getElementById("adminProfileUsername");
const adminProfileContact = document.getElementById("adminProfileContact");
const overviewTitle = document.getElementById("overviewTitle");

let residents = [];
let activity = [];
let requests = [];
let settings = null;
let currentAdmin = null;
const sectionIds = ["residents", "activity", "history"];

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

function getInitials(name) {
  const text = String(name || "").trim();
  if (!text) return "A";
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function renderAdminProfile() {
  const admin = currentAdmin || {};
  const fullName = admin.fullName || admin.username || "Admin User";
  const roleText = admin.adminRole || "Administrator";

  if (adminAvatar) adminAvatar.textContent = getInitials(fullName);
  if (adminProfileName) adminProfileName.textContent = fullName;
  if (adminProfileRole) adminProfileRole.textContent = roleText;
  if (adminProfileEmail) adminProfileEmail.textContent = admin.email || "-";
  if (adminProfileUsername) adminProfileUsername.textContent = admin.username || "-";
  if (adminProfileContact) adminProfileContact.textContent = admin.contact || "-";
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

function statusClass(status) {
  return `status-${String(status || "").toLowerCase()}`;
}

function renderHistory() {
  if (!historyList) return;
  const processed = requests
    .filter((item) => item.status === "Approved" || item.status === "Rejected")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  if (!processed.length) {
    historyList.innerHTML = "<li class='empty'>No approved or rejected requests yet.</li>";
    return;
  }

  historyList.innerHTML = processed.slice(0, 60).map((item) => `
    <li class="history-item">
      <div class="history-row">
        <strong>${escapeHtml(item.user || "-")}</strong>
        <span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status || "-")}</span>
      </div>
      <small>${escapeHtml(item.type || "-")} | ${escapeHtml(item.purpose || "-")} | ${escapeHtml(item.date || "-")}</small>
    </li>
  `).join("");
}

async function loadData() {
  const authUser = apiClient.requireAuth(["admin"]);
  if (!authUser) return false;

  const [settingsPayload, residentsPayload, activityPayload, requestsPayload, mePayload] = await Promise.all([
    apiClient.get("/admin/settings"),
    apiClient.get("/admin/residents"),
    apiClient.get("/admin/activity?limit=60"),
    apiClient.get("/admin/requests"),
    apiClient.get("/users/me").catch(() => ({ user: authUser }))
  ]);

  settings = settingsPayload && settingsPayload.settings ? settingsPayload.settings : {};
  residents = Array.isArray(residentsPayload.residents) ? residentsPayload.residents : [];
  activity = Array.isArray(activityPayload.activity) ? activityPayload.activity : [];
  requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
  currentAdmin = mePayload && mePayload.user ? mePayload.user : authUser;
  return true;
}

function renderAll() {
  applyBranding(settings || {});
  renderAdminProfile();
  renderResidents();
  renderActivity();
  renderHistory();
  applySectionFromHash();
}

function getSectionFromHash() {
  const hash = String(window.location.hash || "").replace("#", "").trim();
  if (hash === "summary" || hash === "overview") {
    window.location.href = "admin-dashboard.html";
    return "residents";
  }
  return sectionIds.includes(hash) ? hash : "residents";
}

function applySectionFromHash() {
  const active = getSectionFromHash();
  const titleMap = {
    residents: { label: "Residents", icon: "fa-users" },
    activity: { label: "Recent Activity", icon: "fa-clock-rotate-left" },
    history: { label: "Approved/Rejected", icon: "fa-check" }
  };

  sectionIds.forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.toggle("hidden", id !== active);
  });

  document.querySelectorAll("[data-section-link]").forEach((link) => {
    const isActive = link.getAttribute("data-section-link") === active;
    link.classList.toggle("active", isActive);
  });

  if (overviewTitle) {
    const title = titleMap[active] || { label: "Admin Overview", icon: "fa-table-list" };
    overviewTitle.innerHTML = `<i class="fa-solid ${title.icon}"></i> ${title.label}`;
  }
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
