let requests = [];
let notifications = [];
let activities = [];
let settings = null;
let currentUser = null;
let activeStatusFilter = "";
let pendingCancelRequestId = null;
let pendingClearCount = 0;
let selectedRequestType = "";

function applyBranding(systemSettings) {
  const branding = systemSettings && systemSettings.branding ? systemSettings.branding : {};
  document.getElementById("systemTitle").textContent = branding.systemName || "BARANGAY REQUEST SYSTEM";
  document.querySelector(".barangay-logo").src = branding.logo || "barangay-logo.jpg";
}

function statusClass(status) {
  return `status-${String(status || "").toLowerCase()}`;
}

function setActiveCard(cardId) {
  document.querySelectorAll(".clickable-card").forEach(card => card.classList.remove("filter-active"));
  document.getElementById(cardId).classList.add("filter-active");
}

function renderTypeFilterOptions() {
  const filter = document.getElementById("typeFilter");
  const currentValue = filter.value;
  const docTypes = Array.isArray(settings.documentTypes) ? settings.documentTypes : [];
  filter.innerHTML = `<option value="">All Types</option>${docTypes.map(type => `<option>${type}</option>`).join("")}`;
  if (docTypes.includes(currentValue)) filter.value = currentValue;
}

function iconClassForType(type) {
  return /id/i.test(type) ? "fa-regular fa-id-card" : "fa-regular fa-file-lines";
}

function renderRequestTypeButtons() {
  const docTypes = Array.isArray(settings.documentTypes) ? settings.documentTypes : [];
  const list = document.getElementById("requestTypeList");
  list.innerHTML = docTypes.map(type => `
    <button class="request-type-btn" data-type="${type}">
      <i class="${iconClassForType(type)}"></i>${type}
    </button>
  `).join("");

  list.querySelectorAll(".request-type-btn").forEach(button => {
    button.addEventListener("click", function () {
      selectRequestType(this.dataset.type, this);
    });
  });
}

function renderCounts() {
  const pending = requests.filter(item => item.status === "Pending").length;
  const approved = requests.filter(item => item.status === "Approved").length;
  document.getElementById("allCount").textContent = requests.length;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("approvedCount").textContent = approved;
}

function renderNotifications() {
  const unread = notifications.filter(item => !item.read).length;
  document.getElementById("notifCount").textContent = unread;
  const list = document.getElementById("notificationList");
  if (!notifications.length) {
    list.innerHTML = "<li class='empty-note'>No notifications.</li>";
    return;
  }
  list.innerHTML = notifications.slice(0, 8).map(item => `
    <li class="${item.read ? "" : "notif-unread"}">${item.message}<small>${item.date}</small></li>
  `).join("");
}

function renderActivity() {
  const list = document.getElementById("activityList");
  if (!activities.length) {
    list.innerHTML = "<li class='empty-note'>No recent activity.</li>";
    return;
  }

  list.innerHTML = activities.slice(0, 8).map(item => `
    <li>${item.message}<small>${item.date}</small></li>
  `).join("");
}

function applyFilters(rows) {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const type = document.getElementById("typeFilter").value;
  const status = document.getElementById("statusFilter").value || activeStatusFilter;
  const date = document.getElementById("dateFilter").value;

  return rows.filter(item => {
    const requestType = String(item.type || "");
    const requestStatus = String(item.status || "");
    const requestDate = String(item.date || "");
    const matchesKeyword = !keyword || requestType.toLowerCase().includes(keyword);
    const matchesType = !type || requestType === type;
    const matchesStatus = !status || requestStatus === status;
    const matchesDate = !date || requestDate === date;
    return matchesKeyword && matchesType && matchesStatus && matchesDate;
  });
}

function renderTable() {
  const body = document.getElementById("requestsTableBody");
  const filtered = applyFilters(requests);

  if (!filtered.length) {
    body.innerHTML = "<tr><td colspan='4' class='empty'>No requests found for your current filters.</td></tr>";
    return;
  }

  body.innerHTML = filtered.map(item => `
    <tr>
      <td>${item.type}</td>
      <td><span class="status-badge ${statusClass(item.status)}">${item.status}</span></td>
      <td>${item.date}</td>
      <td class="cancel-cell">
        ${item.status === "Pending"
          ? `<button class="table-cancel-btn" data-action="cancel" data-id="${item.id}">Cancel Request</button>`
          : "<span class='cancel-unavailable'>-</span>"}
      </td>
    </tr>
  `).join("");
}

function updateTableTitle() {
  const title = document.getElementById("requestTableLabel");
  if (activeStatusFilter === "Pending") title.textContent = "My Pending Requests";
  else if (activeStatusFilter === "Approved") title.textContent = "My Approved Requests";
  else title.textContent = "My Requests";
}

function renderAll() {
  renderCounts();
  renderNotifications();
  renderActivity();
  updateTableTitle();
  renderTable();
}

function buildActivityFromRequests(rows) {
  return rows.slice(0, 20).map(item => ({
    message: `${item.type} is currently ${item.status}.`,
    date: item.date
  }));
}

function syncUserAvatar(user) {
  const avatarImage = document.getElementById("userAvatar");
  const avatarFallback = document.getElementById("userAvatarFallback");
  const avatarUrl = user && user.avatarUrl ? String(user.avatarUrl) : "";

  if (avatarUrl) {
    avatarImage.src = avatarUrl;
    avatarImage.style.display = "block";
    avatarFallback.style.display = "none";
  } else {
    avatarImage.removeAttribute("src");
    avatarImage.style.display = "none";
    avatarFallback.style.display = "inline-flex";
  }
}

function applyUserPreferences(user) {
  const inApp = !user || !user.preferences ? true : Boolean(user.preferences.inApp);
  const notificationGroup = document.querySelector(".header-circle-group");
  notificationGroup.style.display = inApp ? "flex" : "none";
}

async function loadData() {
  currentUser = apiClient.requireAuth(["user"]);
  if (!currentUser) return;

  const [settingsPayload, mePayload, requestsPayload, notificationsPayload] = await Promise.all([
    apiClient.get("/public/settings", { auth: false }),
    apiClient.get("/users/me"),
    apiClient.get("/requests/me"),
    apiClient.get("/notifications/me?limit=50")
  ]);

  settings = settingsPayload.settings || {};
  currentUser = mePayload.user || currentUser;
  requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
  notifications = Array.isArray(notificationsPayload.notifications) ? notificationsPayload.notifications : [];
  activities = buildActivityFromRequests(requests);
}

function filterByStatus(status, cardId) {
  activeStatusFilter = status;
  document.getElementById("statusFilter").value = "";
  setActiveCard(cardId);
  updateTableTitle();
  renderTable();
}

function clearFilters() {
  const removableCount = requests.filter(item => item.status !== "Pending").length;
  if (!removableCount) {
    document.getElementById("searchInput").value = "";
    document.getElementById("typeFilter").value = "";
    document.getElementById("statusFilter").value = "";
    document.getElementById("dateFilter").value = "";
    filterByStatus("", "allCard");
    return;
  }

  pendingClearCount = removableCount;
  document.getElementById("clearConfirmText").textContent = `Clear all non-pending requests (${removableCount})?`;
  document.getElementById("clearConfirmModal").classList.add("show");
}

function closeClearConfirmModal() {
  pendingClearCount = 0;
  document.getElementById("clearConfirmModal").classList.remove("show");
}

async function confirmClearNonPending() {
  if (!pendingClearCount) {
    closeClearConfirmModal();
    return;
  }

  try {
    await apiClient.del("/requests/me/non-pending");
    await loadData();
    document.getElementById("searchInput").value = "";
    document.getElementById("typeFilter").value = "";
    document.getElementById("statusFilter").value = "";
    document.getElementById("dateFilter").value = "";
    activeStatusFilter = "";
    setActiveCard("allCard");
    closeClearConfirmModal();
    renderAll();
  } catch (err) {
    window.alert(err.message || "Failed to clear requests.");
  }
}

function cancelRequest(requestId) {
  const request = requests.find(item => String(item.id) === String(requestId));
  if (!request || request.status !== "Pending") return;
  pendingCancelRequestId = requestId;
  document.getElementById("cancelConfirmModal").classList.add("show");
}

function closeCancelConfirmModal() {
  pendingCancelRequestId = null;
  document.getElementById("cancelConfirmModal").classList.remove("show");
}

async function confirmCancelRequest() {
  if (!pendingCancelRequestId) {
    closeCancelConfirmModal();
    return;
  }

  try {
    await apiClient.patch(`/requests/${pendingCancelRequestId}/cancel`, {});
    await loadData();
    closeCancelConfirmModal();
    renderAll();
  } catch (err) {
    window.alert(err.message || "Failed to cancel request.");
  }
}

async function confirmLogout() {
  try {
    const session = apiClient.getSession();
    if (session.refreshToken) {
      await apiClient.post("/auth/logout", { refreshToken: session.refreshToken });
    }
  } catch (_err) {
    // ignore logout API failure
  } finally {
    apiClient.clearSession();
    window.location.href = "index.html";
  }
}

function openRequestTypeModal() {
  selectedRequestType = "";
  document.querySelectorAll(".request-type-btn").forEach(button => button.classList.remove("request-type-selected"));
  document.getElementById("confirmRequestTypeBtn").disabled = true;
  document.getElementById("requestTypeModal").classList.add("show");
}

function closeRequestTypeModal() {
  selectedRequestType = "";
  document.querySelectorAll(".request-type-btn").forEach(button => button.classList.remove("request-type-selected"));
  document.getElementById("confirmRequestTypeBtn").disabled = true;
  document.getElementById("requestTypeModal").classList.remove("show");
}

function selectRequestType(requestType, buttonElement) {
  selectedRequestType = requestType;
  document.querySelectorAll(".request-type-btn").forEach(button => button.classList.remove("request-type-selected"));
  buttonElement.classList.add("request-type-selected");
  document.getElementById("confirmRequestTypeBtn").disabled = false;
}

function confirmRequestTypeSelection() {
  if (!selectedRequestType) return;
  goToRequestForm(selectedRequestType);
}

function goToRequestForm(requestType) {
  window.location.href = `document-form.html?type=${encodeURIComponent(requestType)}`;
}

async function toggleNotifications() {
  const panel = document.getElementById("notificationPanel");
  panel.classList.toggle("show-panel");

  if (!panel.classList.contains("show-panel")) return;

  const hasUnread = notifications.some(item => !item.read);
  if (!hasUnread) return;

  try {
    await apiClient.patch("/notifications/me/read-all", {});
    notifications = notifications.map(item => ({ ...item, read: true }));
    renderNotifications();
  } catch (_err) {
    // ignore
  }
}

document.getElementById("notificationBtn").addEventListener("click", toggleNotifications);
document.getElementById("navNewRequest").addEventListener("click", openRequestTypeModal);
document.getElementById("navSettings").addEventListener("click", function () {
  window.location.href = "user-settings.html";
});
document.getElementById("navAboutUs").addEventListener("click", function () {
  window.location.href = "aboutus.html";
});
document.getElementById("navLogout").addEventListener("click", confirmLogout);
document.getElementById("clearFiltersBtn").addEventListener("click", clearFilters);
document.getElementById("closeRequestTypeBtn").addEventListener("click", closeRequestTypeModal);
document.getElementById("confirmRequestTypeBtn").addEventListener("click", confirmRequestTypeSelection);
document.getElementById("cancelConfirmNoBtn").addEventListener("click", closeCancelConfirmModal);
document.getElementById("cancelConfirmYesBtn").addEventListener("click", confirmCancelRequest);
document.getElementById("clearConfirmNoBtn").addEventListener("click", closeClearConfirmModal);
document.getElementById("clearConfirmYesBtn").addEventListener("click", confirmClearNonPending);

document.getElementById("allCard").addEventListener("click", function () {
  filterByStatus("", "allCard");
});
document.getElementById("pendingCard").addEventListener("click", function () {
  filterByStatus("Pending", "pendingCard");
});
document.getElementById("approvedCard").addEventListener("click", function () {
  filterByStatus("Approved", "approvedCard");
});
document.getElementById("searchInput").addEventListener("input", renderTable);
document.getElementById("typeFilter").addEventListener("change", renderTable);
document.getElementById("statusFilter").addEventListener("change", function () {
  activeStatusFilter = "";
  document.querySelectorAll(".clickable-card").forEach(card => card.classList.remove("filter-active"));
  renderTable();
  updateTableTitle();
});
document.getElementById("dateFilter").addEventListener("change", renderTable);
document.getElementById("requestsTableBody").addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action='cancel']");
  if (!button) return;
  const requestId = button.getAttribute("data-id");
  cancelRequest(requestId);
});

document.addEventListener("click", function (event) {
  const wrap = document.querySelector(".notification-wrap");
  if (!wrap.contains(event.target)) {
    document.getElementById("notificationPanel").classList.remove("show-panel");
  }
});

document.getElementById("requestTypeModal").addEventListener("click", function (event) {
  if (event.target.id === "requestTypeModal") closeRequestTypeModal();
});
document.getElementById("cancelConfirmModal").addEventListener("click", function (event) {
  if (event.target.id === "cancelConfirmModal") closeCancelConfirmModal();
});
document.getElementById("clearConfirmModal").addEventListener("click", function (event) {
  if (event.target.id === "clearConfirmModal") closeClearConfirmModal();
});
document.getElementById("userAvatar").addEventListener("error", function () {
  this.removeAttribute("src");
  this.style.display = "none";
  document.getElementById("userAvatarFallback").style.display = "inline-flex";
});

loadData()
  .then(function () {
    applyBranding(settings || {});
    renderTypeFilterOptions();
    renderRequestTypeButtons();
    syncUserAvatar(currentUser || {});
    applyUserPreferences(currentUser || {});
    setActiveCard("allCard");
    renderAll();
  })
  .catch(function (err) {
    window.alert(err.message || "Failed to load dashboard data.");
  });
