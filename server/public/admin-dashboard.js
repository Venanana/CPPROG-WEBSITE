const requestsBody = document.getElementById("adminRequestsBody");
const residentBody = document.getElementById("residentTableBody");
const activityList = document.getElementById("adminActivityList");
const detailsModal = document.getElementById("detailsModal");
const detailsGrid = document.getElementById("detailsGrid");

let requests = [];
let residents = [];
let activity = [];
let settings = null;

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
  document.getElementById("adminSubtitle").textContent = branding.adminSubtitle || "Admin Request Management";
  document.getElementById("brandLogo").src = branding.logo || "barangay-logo.jpg";
}

function renderTypeOptions() {
  const filter = document.getElementById("typeFilter");
  const current = filter.value;
  const types = Array.isArray(settings.documentTypes) ? settings.documentTypes : [];
  filter.innerHTML = `<option value="">All Types</option>${types.map(type => `<option>${escapeHtml(type)}</option>`).join("")}`;
  if (types.includes(current)) filter.value = current;
}

function getFilteredRequests() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const type = document.getElementById("typeFilter").value;
  const status = document.getElementById("statusFilter").value;
  const date = document.getElementById("dateFilter").value;

  return requests.filter(function (item) {
    const requestType = String(item.type || "");
    const resident = String(item.user || "");
    const purpose = String(item.purpose || "");
    const contact = String(item.contact || "");
    const address = String(item.address || "");
    const requestStatus = String(item.status || "");
    const requestDate = String(item.date || "");

    const keywordTarget = `${resident} ${requestType} ${purpose} ${contact} ${address}`.toLowerCase();
    const matchesKeyword = !keyword || keywordTarget.includes(keyword);
    const matchesType = !type || requestType === type;
    const matchesStatus = !status || requestStatus === status;
    const matchesDate = !date || requestDate === date;
    return matchesKeyword && matchesType && matchesStatus && matchesDate;
  });
}

function statusClass(status) {
  return `status-${String(status || "").toLowerCase()}`;
}

function renderStats() {
  const pending = requests.filter(item => item.status === "Pending").length;
  const approved = requests.filter(item => item.status === "Approved").length;
  const rejected = requests.filter(item => item.status === "Rejected").length;
  const cancelled = requests.filter(item => item.status === "Cancelled").length;

  document.getElementById("totalCount").textContent = requests.length;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("approvedCount").textContent = approved;
  document.getElementById("rejectedCount").textContent = rejected;
  document.getElementById("cancelledCount").textContent = cancelled;
}

function renderRequests() {
  const filtered = getFilteredRequests();
  if (!filtered.length) {
    requestsBody.innerHTML = "<tr><td colspan='7' class='empty'>No request submissions found.</td></tr>";
    return;
  }

  const allowReset = Boolean(settings && settings.workflow && settings.workflow.allowResetToPending);

  requestsBody.innerHTML = filtered.map(function (item) {
    const id = escapeHtml(item.id);
    const actionButtons = item.status === "Pending"
      ? `<button class="table-btn approve-btn" data-action="approve" data-id="${id}">Approve</button>
         <button class="table-btn reject-btn" data-action="reject" data-id="${id}">Reject</button>`
      : (allowReset
        ? `<button class="table-btn pending-btn" data-action="pending" data-id="${id}">Set Pending</button>`
        : "<span class='empty'>-</span>");

    return `
      <tr>
        <td>${escapeHtml(item.user || "-")}</td>
        <td>${escapeHtml(item.contact || "-")}</td>
        <td>${escapeHtml(item.type || "-")}</td>
        <td class="purpose-col">${escapeHtml(item.purpose || "-")}</td>
        <td>${escapeHtml(item.date || "-")}</td>
        <td><span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status || "Pending")}</span></td>
        <td class="action-col">
          <button class="table-btn view-btn" data-action="view" data-id="${id}">View</button>
          ${actionButtons}
        </td>
      </tr>
    `;
  }).join("");
}

function renderResidents() {
  if (!residents.length) {
    residentBody.innerHTML = "<tr><td colspan='6' class='empty'>No registered residents found.</td></tr>";
    return;
  }

  residentBody.innerHTML = residents.map(function (item) {
    const createdAt = item.createdAt ? String(item.createdAt).slice(0, 10) : "-";
    return `
      <tr>
        <td>${escapeHtml(item.fullName || "-")}</td>
        <td>${escapeHtml(item.username || "-")}</td>
        <td>${escapeHtml(item.email || "-")}</td>
        <td>${escapeHtml(item.contact || "-")}</td>
        <td>${escapeHtml(item.dob || "-")}</td>
        <td>${escapeHtml(createdAt)}</td>
      </tr>
    `;
  }).join("");
}

function renderActivity() {
  if (!activity.length) {
    activityList.innerHTML = "<li class='empty'>No activity yet.</li>";
    return;
  }
  activityList.innerHTML = activity.slice(0, 12).map(item => `
    <li>${escapeHtml(item.message || "")}<small>${escapeHtml(item.date || "-")}</small></li>
  `).join("");
}

function showRequestDetails(requestId) {
  const row = requests.find(item => String(item.id) === String(requestId));
  if (!row) return;

  detailsGrid.innerHTML = `
    <dt>Resident</dt><dd>${escapeHtml(row.user || "-")}</dd>
    <dt>Address</dt><dd>${escapeHtml(row.address || "-")}</dd>
    <dt>Contact</dt><dd>${escapeHtml(row.contact || "-")}</dd>
    <dt>Request Type</dt><dd>${escapeHtml(row.type || "-")}</dd>
    <dt>Purpose</dt><dd>${escapeHtml(row.purpose || "-")}</dd>
    <dt>Status</dt><dd>${escapeHtml(row.status || "-")}</dd>
    <dt>Date Submitted</dt><dd>${escapeHtml(row.date || "-")}</dd>
    <dt>Request ID</dt><dd>${escapeHtml(row.id || "-")}</dd>
  `;
  detailsModal.classList.add("show");
}

function hideDetailsModal() {
  detailsModal.classList.remove("show");
}

function clearFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("typeFilter").value = "";
  document.getElementById("statusFilter").value = "";
  document.getElementById("dateFilter").value = "";
  renderRequests();
}

async function updateRequestStatus(requestId, nextStatus) {
  await apiClient.patch(`/admin/requests/${requestId}/status`, { status: nextStatus });
  await loadData();
  renderAll();
}

async function loadData() {
  const authUser = apiClient.requireAuth(["admin"]);
  if (!authUser) return;

  const [settingsPayload, requestsPayload, residentsPayload, activityPayload] = await Promise.all([
    apiClient.get("/admin/settings"),
    apiClient.get("/admin/requests"),
    apiClient.get("/admin/residents"),
    apiClient.get("/admin/activity?limit=30")
  ]);

  settings = settingsPayload.settings || {};
  requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
  residents = Array.isArray(residentsPayload.residents) ? residentsPayload.residents : [];
  activity = Array.isArray(activityPayload.activity) ? activityPayload.activity : [];
}

function renderAll() {
  applyBranding(settings || {});
  renderTypeOptions();
  renderStats();
  renderRequests();
  renderResidents();
  renderActivity();
}

async function logoutAdmin(event) {
  if (event) event.preventDefault();
  try {
    const session = apiClient.getSession();
    if (session.refreshToken) {
      await apiClient.post("/auth/logout", { refreshToken: session.refreshToken });
    }
  } catch (_err) {
    // ignore
  } finally {
    apiClient.clearSession();
    window.location.href = "index.html";
  }
}

requestsBody.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.getAttribute("data-action");
  const requestId = button.getAttribute("data-id");

  if (action === "view") {
    showRequestDetails(requestId);
    return;
  }
  if (action === "approve") {
    updateRequestStatus(requestId, "Approved").catch(err => window.alert(err.message || "Update failed."));
    return;
  }
  if (action === "reject") {
    updateRequestStatus(requestId, "Rejected").catch(err => window.alert(err.message || "Update failed."));
    return;
  }
  if (action === "pending") {
    updateRequestStatus(requestId, "Pending").catch(err => window.alert(err.message || "Update failed."));
  }
});

document.getElementById("searchInput").addEventListener("input", renderRequests);
document.getElementById("typeFilter").addEventListener("change", renderRequests);
document.getElementById("statusFilter").addEventListener("change", renderRequests);
document.getElementById("dateFilter").addEventListener("change", renderRequests);
document.getElementById("clearFiltersBtn").addEventListener("click", clearFilters);
document.getElementById("closeDetailsBtn").addEventListener("click", hideDetailsModal);

detailsModal.addEventListener("click", function (event) {
  if (event.target.id === "detailsModal") hideDetailsModal();
});

loadData()
  .then(renderAll)
  .catch(function (err) {
    window.alert(err.message || "Failed to load admin dashboard.");
  });
