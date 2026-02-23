const DEFAULT_DOCUMENT_TYPES = [
  "Barangay Clearance",
  "Certification of Indigency",
  "Barangay ID",
  "Certificate of Residency"
];

const state = {
  requests: [],
  notifications: [],
  activities: [],
  settings: null,
  currentUser: null,
  activeStatusFilter: "",
  pendingCancelRequestId: null,
  pendingClearCount: 0,
  selectedRequestType: ""
};

const dom = {
  byId(id) {
    return document.getElementById(id);
  },
  qs(selector) {
    return document.querySelector(selector);
  },
  qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  },
  bindClick(id, handler) {
    const element = this.byId(id);
    if (!element) return;
    element.addEventListener("click", handler);
  }
};

function statusClass(status) {
  return `status-${String(status || "").toLowerCase()}`;
}

function iconClassForType(type) {
  return /id/i.test(type) ? "fa-regular fa-id-card" : "fa-regular fa-file-lines";
}

function getDocumentTypes() {
  const fromSettings = state.settings && Array.isArray(state.settings.documentTypes)
    ? state.settings.documentTypes.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  return fromSettings.length ? fromSettings : DEFAULT_DOCUMENT_TYPES;
}

function buildActivityFromRequests(rows) {
  return rows.slice(0, 20).map(item => ({
    message: `${item.type} is currently ${item.status}.`,
    date: item.date
  }));
}

function setActiveCard(cardId) {
  dom.qsa(".clickable-card").forEach(card => card.classList.remove("filter-active"));
  const card = dom.byId(cardId);
  if (card) card.classList.add("filter-active");
}

function updateTableTitle() {
  const title = dom.byId("requestTableLabel");
  if (!title) return;

  if (state.activeStatusFilter === "Pending") {
    title.textContent = "My Pending Requests";
    return;
  }
  if (state.activeStatusFilter === "Approved") {
    title.textContent = "My Approved Requests";
    return;
  }
  title.textContent = "My Requests";
}

function applyBranding() {
  const branding = state.settings && state.settings.branding ? state.settings.branding : {};
  const title = dom.byId("systemTitle");
  const logo = dom.qs(".barangay-logo");
  if (title) title.textContent = branding.systemName || "BARANGAY REQUEST SYSTEM";
  if (logo) logo.src = branding.logo || "barangay-logo.jpg";
}

function syncUserAvatar() {
  const avatarImage = dom.byId("userAvatar");
  const avatarFallback = dom.byId("userAvatarFallback");
  if (!avatarImage || !avatarFallback) return;

  const avatarUrl = state.currentUser && state.currentUser.avatarUrl ? String(state.currentUser.avatarUrl) : "";

  if (avatarUrl) {
    avatarImage.src = avatarUrl;
    avatarImage.style.display = "block";
    avatarFallback.style.display = "none";
    return;
  }

  avatarImage.removeAttribute("src");
  avatarImage.style.display = "none";
  avatarFallback.style.display = "inline-flex";
}

function applyUserPreferences() {
  const inApp = !state.currentUser || !state.currentUser.preferences
    ? true
    : Boolean(state.currentUser.preferences.inApp);

  const notificationGroup = dom.qs(".header-circle-group");
  if (notificationGroup) notificationGroup.style.display = inApp ? "flex" : "none";
}

function renderTypeFilterOptions() {
  const filter = dom.byId("typeFilter");
  if (!filter) return;

  const currentValue = filter.value;
  const docTypes = getDocumentTypes();

  filter.innerHTML = `<option value="">All Types</option>${docTypes.map(type => `<option>${type}</option>`).join("")}`;
  if (docTypes.includes(currentValue)) filter.value = currentValue;
}

function renderRequestTypeButtons() {
  const list = dom.byId("requestTypeList");
  if (!list) return;

  const docTypes = getDocumentTypes();
  list.innerHTML = docTypes.map(type => `
    <button class="request-type-btn" data-type="${type}">
      <i class="${iconClassForType(type)}"></i>${type}
    </button>
  `).join("");

  dom.qsa(".request-type-btn").forEach(button => {
    button.addEventListener("click", function () {
      selectRequestType(this.dataset.type, this);
    });
  });
}

function renderCounts() {
  const pending = state.requests.filter(item => item.status === "Pending").length;
  const approved = state.requests.filter(item => item.status === "Approved").length;

  const allCount = dom.byId("allCount");
  const pendingCount = dom.byId("pendingCount");
  const approvedCount = dom.byId("approvedCount");

  if (allCount) allCount.textContent = state.requests.length;
  if (pendingCount) pendingCount.textContent = pending;
  if (approvedCount) approvedCount.textContent = approved;
}

function renderNotifications() {
  const unread = state.notifications.filter(item => !item.read).length;
  const count = dom.byId("notifCount");
  const list = dom.byId("notificationList");

  if (count) count.textContent = unread;
  if (!list) return;

  if (!state.notifications.length) {
    list.innerHTML = "<li class='empty-note'>No notifications.</li>";
    return;
  }

  list.innerHTML = state.notifications.slice(0, 8).map(item => `
    <li class="${item.read ? "" : "notif-unread"}">${item.message}<small>${item.date}</small></li>
  `).join("");
}

function renderActivity() {
  const list = dom.byId("activityList");
  if (!list) return;

  if (!state.activities.length) {
    list.innerHTML = "<li class='empty-note'>No recent activity.</li>";
    return;
  }

  list.innerHTML = state.activities.slice(0, 8).map(item => `
    <li>${item.message}<small>${item.date}</small></li>
  `).join("");
}

function getFilteredRequests(rows) {
  const keyword = String(dom.byId("searchInput") && dom.byId("searchInput").value || "").trim().toLowerCase();
  const type = String(dom.byId("typeFilter") && dom.byId("typeFilter").value || "");
  const statusValue = String(dom.byId("statusFilter") && dom.byId("statusFilter").value || "");
  const status = statusValue || state.activeStatusFilter;
  const date = String(dom.byId("dateFilter") && dom.byId("dateFilter").value || "");

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
  const body = dom.byId("requestsTableBody");
  if (!body) return;

  const filtered = getFilteredRequests(state.requests);

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

function renderAll() {
  applyBranding();
  renderTypeFilterOptions();
  renderCounts();
  renderNotifications();
  renderActivity();
  updateTableTitle();
  renderTable();
  syncUserAvatar();
  applyUserPreferences();
}

const api = {
  async loadDashboardData() {
    state.currentUser = apiClient.requireAuth(["user"]);
    if (!state.currentUser) return false;

    const [settingsPayload, mePayload, requestsPayload, notificationsPayload] = await Promise.all([
      apiClient.get("/public/settings", { auth: false }),
      apiClient.get("/users/me"),
      apiClient.get("/requests/me"),
      apiClient.get("/notifications/me?limit=50")
    ]);

    state.settings = settingsPayload.settings || {};
    state.currentUser = mePayload.user || state.currentUser;
    state.requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
    state.notifications = Array.isArray(notificationsPayload.notifications) ? notificationsPayload.notifications : [];
    state.activities = buildActivityFromRequests(state.requests);
    return true;
  },

  async clearNonPendingRequests() {
    await apiClient.del("/requests/me/non-pending");
  },

  async cancelPendingRequest(requestId) {
    await apiClient.patch(`/requests/${requestId}/cancel`, {});
  },

  async markNotificationsRead() {
    await apiClient.patch("/notifications/me/read-all", {});
  },

  async logout() {
    const session = apiClient.getSession();
    if (session.refreshToken) {
      await apiClient.post("/auth/logout", { refreshToken: session.refreshToken });
    }
  }
};

function filterByStatus(status, cardId) {
  state.activeStatusFilter = status;
  const statusFilter = dom.byId("statusFilter");
  if (statusFilter) statusFilter.value = "";
  setActiveCard(cardId);
  updateTableTitle();
  renderTable();
}

function closeRequestTypeModal() {
  state.selectedRequestType = "";
  dom.qsa(".request-type-btn").forEach(button => button.classList.remove("request-type-selected"));
  const confirmBtn = dom.byId("confirmRequestTypeBtn");
  if (confirmBtn) confirmBtn.disabled = true;

  const modal = dom.byId("requestTypeModal");
  if (modal) modal.classList.remove("show");
}

function openRequestTypeModal() {
  renderRequestTypeButtons();
  state.selectedRequestType = "";
  dom.qsa(".request-type-btn").forEach(button => button.classList.remove("request-type-selected"));

  const confirmBtn = dom.byId("confirmRequestTypeBtn");
  if (confirmBtn) confirmBtn.disabled = true;

  const modal = dom.byId("requestTypeModal");
  if (modal) modal.classList.add("show");
}

function selectRequestType(requestType, buttonElement) {
  state.selectedRequestType = requestType;
  dom.qsa(".request-type-btn").forEach(button => button.classList.remove("request-type-selected"));
  buttonElement.classList.add("request-type-selected");

  const confirmBtn = dom.byId("confirmRequestTypeBtn");
  if (confirmBtn) confirmBtn.disabled = false;
}

function goToRequestForm(requestType) {
  window.location.href = `document-form.html?type=${encodeURIComponent(requestType)}`;
}

function confirmRequestTypeSelection() {
  if (!state.selectedRequestType) return;
  goToRequestForm(state.selectedRequestType);
}

function closeCancelConfirmModal() {
  state.pendingCancelRequestId = null;
  const modal = dom.byId("cancelConfirmModal");
  if (modal) modal.classList.remove("show");
}

function cancelRequest(requestId) {
  const request = state.requests.find(item => String(item.id) === String(requestId));
  if (!request || request.status !== "Pending") return;

  state.pendingCancelRequestId = requestId;
  const modal = dom.byId("cancelConfirmModal");
  if (modal) modal.classList.add("show");
}

async function confirmCancelRequest() {
  if (!state.pendingCancelRequestId) {
    closeCancelConfirmModal();
    return;
  }

  try {
    await api.cancelPendingRequest(state.pendingCancelRequestId);
    await api.loadDashboardData();
    closeCancelConfirmModal();
    renderAll();
  } catch (err) {
    window.alert(err.message || "Failed to cancel request.");
  }
}

function closeClearConfirmModal() {
  state.pendingClearCount = 0;
  const modal = dom.byId("clearConfirmModal");
  if (modal) modal.classList.remove("show");
}

function clearFilters() {
  const removableCount = state.requests.filter(item => item.status !== "Pending").length;

  if (!removableCount) {
    const search = dom.byId("searchInput");
    const type = dom.byId("typeFilter");
    const status = dom.byId("statusFilter");
    const date = dom.byId("dateFilter");

    if (search) search.value = "";
    if (type) type.value = "";
    if (status) status.value = "";
    if (date) date.value = "";

    filterByStatus("", "allCard");
    return;
  }

  state.pendingClearCount = removableCount;
  const text = dom.byId("clearConfirmText");
  if (text) text.textContent = `Clear all non-pending requests (${removableCount})?`;

  const modal = dom.byId("clearConfirmModal");
  if (modal) modal.classList.add("show");
}

async function confirmClearNonPending() {
  if (!state.pendingClearCount) {
    closeClearConfirmModal();
    return;
  }

  try {
    await api.clearNonPendingRequests();
    await api.loadDashboardData();

    const search = dom.byId("searchInput");
    const type = dom.byId("typeFilter");
    const status = dom.byId("statusFilter");
    const date = dom.byId("dateFilter");

    if (search) search.value = "";
    if (type) type.value = "";
    if (status) status.value = "";
    if (date) date.value = "";

    state.activeStatusFilter = "";
    setActiveCard("allCard");
    closeClearConfirmModal();
    renderAll();
  } catch (err) {
    window.alert(err.message || "Failed to clear requests.");
  }
}

async function toggleNotifications() {
  const panel = dom.byId("notificationPanel");
  if (!panel) return;

  panel.classList.toggle("show-panel");
  if (!panel.classList.contains("show-panel")) return;

  const hasUnread = state.notifications.some(item => !item.read);
  if (!hasUnread) return;

  try {
    await api.markNotificationsRead();
    state.notifications = state.notifications.map(item => ({ ...item, read: true }));
    renderNotifications();
  } catch (_err) {
    // ignore read-all failures to keep notification panel usable
  }
}

async function confirmLogout() {
  try {
    await api.logout();
  } catch (_err) {
    // ignore logout API failures and always clear local session
  } finally {
    apiClient.clearSession();
    window.location.href = "index.html";
  }
}

function bindEvents() {
  dom.bindClick("notificationBtn", toggleNotifications);
  dom.bindClick("navNewRequest", function (event) {
    event.preventDefault();
    openRequestTypeModal();
  });
  dom.bindClick("navSettings", function () {
    window.location.href = "user-settings.html";
  });
  dom.bindClick("navAboutUs", function () {
    window.location.href = "aboutus.html";
  });
  dom.bindClick("navLogout", confirmLogout);
  dom.bindClick("clearFiltersBtn", clearFilters);
  dom.bindClick("closeRequestTypeBtn", closeRequestTypeModal);
  dom.bindClick("confirmRequestTypeBtn", confirmRequestTypeSelection);
  dom.bindClick("cancelConfirmNoBtn", closeCancelConfirmModal);
  dom.bindClick("cancelConfirmYesBtn", confirmCancelRequest);
  dom.bindClick("clearConfirmNoBtn", closeClearConfirmModal);
  dom.bindClick("clearConfirmYesBtn", confirmClearNonPending);

  const allCard = dom.byId("allCard");
  if (allCard) {
    allCard.addEventListener("click", function () {
      filterByStatus("", "allCard");
    });
  }

  const pendingCard = dom.byId("pendingCard");
  if (pendingCard) {
    pendingCard.addEventListener("click", function () {
      filterByStatus("Pending", "pendingCard");
    });
  }

  const approvedCard = dom.byId("approvedCard");
  if (approvedCard) {
    approvedCard.addEventListener("click", function () {
      filterByStatus("Approved", "approvedCard");
    });
  }

  const searchInput = dom.byId("searchInput");
  if (searchInput) searchInput.addEventListener("input", renderTable);

  const typeFilter = dom.byId("typeFilter");
  if (typeFilter) typeFilter.addEventListener("change", renderTable);

  const statusFilter = dom.byId("statusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", function () {
      state.activeStatusFilter = "";
      dom.qsa(".clickable-card").forEach(card => card.classList.remove("filter-active"));
      renderTable();
      updateTableTitle();
    });
  }

  const dateFilter = dom.byId("dateFilter");
  if (dateFilter) dateFilter.addEventListener("change", renderTable);

  const requestsTableBody = dom.byId("requestsTableBody");
  if (requestsTableBody) {
    requestsTableBody.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action='cancel']");
      if (!button) return;
      const requestId = button.getAttribute("data-id");
      cancelRequest(requestId);
    });
  }

  document.addEventListener("click", function (event) {
    const wrap = dom.qs(".notification-wrap");
    const panel = dom.byId("notificationPanel");
    if (!wrap || !panel) return;
    if (!wrap.contains(event.target)) {
      panel.classList.remove("show-panel");
    }
  });

  const requestTypeModal = dom.byId("requestTypeModal");
  if (requestTypeModal) {
    requestTypeModal.addEventListener("click", function (event) {
      if (event.target.id === "requestTypeModal") closeRequestTypeModal();
    });
  }

  const cancelConfirmModal = dom.byId("cancelConfirmModal");
  if (cancelConfirmModal) {
    cancelConfirmModal.addEventListener("click", function (event) {
      if (event.target.id === "cancelConfirmModal") closeCancelConfirmModal();
    });
  }

  const clearConfirmModal = dom.byId("clearConfirmModal");
  if (clearConfirmModal) {
    clearConfirmModal.addEventListener("click", function (event) {
      if (event.target.id === "clearConfirmModal") closeClearConfirmModal();
    });
  }

  const avatar = dom.byId("userAvatar");
  if (avatar) {
    avatar.addEventListener("error", function () {
      this.removeAttribute("src");
      this.style.display = "none";
      const fallback = dom.byId("userAvatarFallback");
      if (fallback) fallback.style.display = "inline-flex";
    });
  }
}

async function init() {
  const loaded = await api.loadDashboardData();
  if (!loaded) return;

  setActiveCard("allCard");
  renderRequestTypeButtons();
  renderAll();
}

bindEvents();
init().catch(function (err) {
  window.alert(err.message || "Failed to load dashboard data.");
});
