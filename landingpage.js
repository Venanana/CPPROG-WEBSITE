
const DEFAULT_DOCUMENT_TYPES = [
  "Barangay Clearance",
  "Certification of Indigency",
  "Barangay ID",
  "Certificate of Residency"
];

const NOTIF_PREFS_PREFIX = "dashboard_notif_prefs_";

const state = {
  requests: [],
  notifications: [],
  activities: [],
  settings: null,
  currentUser: null,
  activeStatusFilter: "",
  activeQuickChip: "all",
  activeNotifFilter: "all",
  pendingCancelRequestId: null,
  pendingClearCount: 0,
  selectedRequestType: "",
  selectedDetailsRequestId: null,
  loading: false
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

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateDisplay(value) {
  const date = parseIsoDate(value);
  if (!date) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function formatDateTimeDisplay(value) {
  const date = parseIsoDate(value);
  if (!date) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDocumentTypes() {
  const fromSettings = state.settings && Array.isArray(state.settings.documentTypes)
    ? state.settings.documentTypes.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return fromSettings.length ? fromSettings : DEFAULT_DOCUMENT_TYPES;
}

function getNotifPrefsKey() {
  const userId = state.currentUser && state.currentUser.id ? String(state.currentUser.id) : "anon";
  return `${NOTIF_PREFS_PREFIX}${userId}`;
}

function readNotifPrefs() {
  try {
    const raw = localStorage.getItem(getNotifPrefsKey());
    if (!raw) return { archivedIds: [], readState: {} };
    const parsed = JSON.parse(raw);
    return {
      archivedIds: Array.isArray(parsed.archivedIds) ? parsed.archivedIds.map((id) => String(id)) : [],
      readState: parsed && typeof parsed.readState === "object" && parsed.readState
        ? parsed.readState
        : {}
    };
  } catch (_err) {
    return { archivedIds: [], readState: {} };
  }
}

function writeNotifPrefs(prefs) {
  localStorage.setItem(getNotifPrefsKey(), JSON.stringify(prefs));
}

function getNotifEffectiveState(notification) {
  const prefs = readNotifPrefs();
  const id = String(notification.id);
  const archived = prefs.archivedIds.includes(id);
  const override = Object.prototype.hasOwnProperty.call(prefs.readState, id)
    ? prefs.readState[id]
    : null;

  return {
    archived,
    read: override === null ? Boolean(notification.read) : Boolean(override)
  };
}

function setNotifReadState(notificationId, read) {
  const prefs = readNotifPrefs();
  prefs.readState[String(notificationId)] = Boolean(read);
  writeNotifPrefs(prefs);
}

function setNotifArchived(notificationId, archived) {
  const prefs = readNotifPrefs();
  const id = String(notificationId);
  const exists = prefs.archivedIds.includes(id);

  if (archived && !exists) prefs.archivedIds.push(id);
  if (!archived && exists) prefs.archivedIds = prefs.archivedIds.filter((item) => item !== id);

  writeNotifPrefs(prefs);
}

function clearNotifReadOverrides() {
  const prefs = readNotifPrefs();
  prefs.readState = {};
  writeNotifPrefs(prefs);
}

function buildActivityFromRequests(rows) {
  return rows.slice(0, 20).map((item) => {
    let actionText = "updated";
    if (item.status === "Pending") actionText = "submitted";
    if (item.status === "Approved") actionText = "approved";
    if (item.status === "Rejected") actionText = "rejected";
    if (item.status === "Cancelled") actionText = "cancelled";

    return {
      message: `${item.type} request was ${actionText}.`,
      date: item.updatedAt || item.submittedAt || item.date
    };
  });
}

function showBanner(message, showRetry) {
  const banner = dom.byId("dashboardBanner");
  const text = dom.byId("dashboardBannerText");
  const retry = dom.byId("dashboardRetryBtn");
  if (!banner || !text || !retry) return;

  text.textContent = message;
  banner.classList.remove("hidden");
  retry.classList.toggle("hidden", !showRetry);
}

function hideBanner() {
  const banner = dom.byId("dashboardBanner");
  if (banner) banner.classList.add("hidden");
}

function setActiveCard(cardId) {
  dom.qsa(".clickable-card").forEach((card) => card.classList.remove("filter-active"));
  const card = dom.byId(cardId);
  if (card) card.classList.add("filter-active");
}

function clearActiveCards() {
  dom.qsa(".clickable-card").forEach((card) => card.classList.remove("filter-active"));
}

function updateTableTitle() {
  const title = dom.byId("requestTableLabel");
  if (!title) return;

  if (state.activeQuickChip === "thisWeek") {
    title.textContent = "My Requests This Week";
    return;
  }
  if (state.activeQuickChip === "needsAction") {
    title.textContent = "Requests Needing Action";
    return;
  }
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

  const avatarUrl = state.currentUser && state.currentUser.avatarUrl
    ? String(state.currentUser.avatarUrl)
    : "";

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

  const notificationBtn = dom.byId("notificationBtn");
  const notificationGroup = notificationBtn ? notificationBtn.closest(".header-circle-group") : null;
  if (notificationGroup) notificationGroup.style.display = inApp ? "flex" : "none";
}

function calculateProfileCompletion() {
  const user = state.currentUser || {};
  const checks = [
    Boolean(user.fullName),
    Boolean(user.email),
    Boolean(user.contact),
    Boolean(user.address),
    Boolean(user.dob),
    Boolean(user.avatarUrl)
  ];

  const completed = checks.filter(Boolean).length;
  const total = checks.length;
  const percent = Math.round((completed / total) * 100);

  return { percent, completed, total };
}

function renderProfileCompletion() {
  const text = dom.byId("profileCompletionText");
  const hint = dom.byId("profileCompletionHint");
  const bar = dom.byId("profileCompletionBar");
  if (!text || !hint || !bar) return;

  const completion = calculateProfileCompletion();
  text.textContent = `${completion.percent}%`;
  bar.style.width = `${completion.percent}%`;

  if (completion.percent >= 100) {
    hint.textContent = "Profile complete. Your requests can be processed faster.";
    return;
  }

  hint.textContent = `Complete ${completion.total - completion.completed} more profile field(s) for faster request processing.`;
}

function renderTypeFilterOptions() {
  const filter = dom.byId("typeFilter");
  if (!filter) return;

  const currentValue = filter.value;
  const docTypes = getDocumentTypes();

  filter.innerHTML = `<option value="">All Types</option>${docTypes.map((type) => `<option>${escapeHtml(type)}</option>`).join("")}`;
  if (docTypes.includes(currentValue)) filter.value = currentValue;
}

function renderRequestTypeButtons() {
  const list = dom.byId("requestTypeList");
  if (!list) return;

  const docTypes = getDocumentTypes();
  list.innerHTML = docTypes.map((type) => {
    const escapedType = escapeHtml(type);
    return `
      <button class="request-type-btn" data-type="${escapedType}" type="button">
        <i class="${iconClassForType(type)}"></i>${escapedType}
      </button>
    `;
  }).join("");

  dom.qsa(".request-type-btn").forEach((button) => {
    button.addEventListener("click", function () {
      selectRequestType(this.dataset.type, this);
    });
  });
}

function renderCounts() {
  const pending = state.requests.filter((item) => item.status === "Pending").length;
  const approved = state.requests.filter((item) => item.status === "Approved").length;

  const allCount = dom.byId("allCount");
  const pendingCount = dom.byId("pendingCount");
  const approvedCount = dom.byId("approvedCount");

  if (allCount) allCount.textContent = state.requests.length;
  if (pendingCount) pendingCount.textContent = pending;
  if (approvedCount) approvedCount.textContent = approved;
}
function renderNotifications() {
  const count = dom.byId("notifCount");
  const list = dom.byId("notificationList");
  if (!list || !count) return;

  const withState = state.notifications.map((item) => {
    const effective = getNotifEffectiveState(item);
    return {
      ...item,
      archived: effective.archived,
      read: effective.read
    };
  });

  const unreadUnarchived = withState.filter((item) => !item.read && !item.archived).length;
  count.textContent = unreadUnarchived;

  const filtered = withState.filter((item) => {
    if (state.activeNotifFilter === "unread") return !item.read && !item.archived;
    if (state.activeNotifFilter === "archived") return item.archived;
    return !item.archived;
  });

  if (!filtered.length) {
    list.innerHTML = "<li class='empty-note'>No notifications in this view.</li>";
    return;
  }

  list.innerHTML = filtered.slice(0, 20).map((item) => {
    const readAction = item.read ? "Mark Unread" : "Mark Read";
    const archiveAction = item.archived ? "Unarchive" : "Archive";
    return `
      <li class="${item.read ? "" : "notif-unread"}">
        <div class="notif-text">${escapeHtml(item.message)}</div>
        <small>${formatDateTimeDisplay(item.createdAt || item.date)}</small>
        <div class="notif-actions">
          <button class="notif-item-btn" data-notif-action="toggle-read" data-id="${item.id}" type="button">${readAction}</button>
          <button class="notif-item-btn" data-notif-action="toggle-archive" data-id="${item.id}" type="button">${archiveAction}</button>
        </div>
      </li>
    `;
  }).join("");
}

function renderActivity() {
  const list = dom.byId("activityList");
  if (!list) return;

  if (!state.activities.length) {
    list.innerHTML = "<li class='empty-note'>No recent activity.</li>";
    return;
  }

  list.innerHTML = state.activities.slice(0, 8).map((item) => `
    <li>${escapeHtml(item.message)}<small>${formatDateTimeDisplay(item.date)}</small></li>
  `).join("");
}

function getStatusFilterValue() {
  const statusFilterValue = String(dom.byId("statusFilter") && dom.byId("statusFilter").value || "");
  if (statusFilterValue) return statusFilterValue;
  if (state.activeStatusFilter) return state.activeStatusFilter;
  if (state.activeQuickChip === "pending") return "Pending";
  if (state.activeQuickChip === "approved") return "Approved";
  return "";
}

function isWithinLastWeek(dateValue) {
  const parsed = parseIsoDate(dateValue);
  if (!parsed) return false;
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  return parsed >= sevenDaysAgo && parsed <= now;
}

function requestNeedsAction(request) {
  return request.status === "Rejected";
}

function getFilteredRequests(rows) {
  const keyword = String(dom.byId("searchInput") && dom.byId("searchInput").value || "").trim().toLowerCase();
  const type = String(dom.byId("typeFilter") && dom.byId("typeFilter").value || "");
  const date = String(dom.byId("dateFilter") && dom.byId("dateFilter").value || "");
  const status = getStatusFilterValue();

  return rows.filter((item) => {
    const requestType = String(item.type || "");
    const requestStatus = String(item.status || "");
    const requestDate = String(item.date || "");

    const matchesKeyword = !keyword || requestType.toLowerCase().includes(keyword);
    const matchesType = !type || requestType === type;
    const matchesStatus = !status || requestStatus === status;
    const matchesDate = !date || requestDate === date;

    if (!matchesKeyword || !matchesType || !matchesStatus || !matchesDate) return false;

    if (state.activeQuickChip === "thisWeek") {
      return isWithinLastWeek(item.submittedAt || item.date);
    }

    if (state.activeQuickChip === "needsAction") {
      return requestNeedsAction(item);
    }

    return true;
  });
}

function buildEmptyStateHtml() {
  if (!state.requests.length) {
    return `
      <div class="empty-state">
        <h4>No requests yet</h4>
        <p>Create your first request to start tracking approvals here.</p>
        <button class="empty-cta-btn" data-action="open-request-type" type="button">Create New Request</button>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <h4>No matching requests</h4>
      <p>Try adjusting your filters or search term.</p>
      <button class="empty-cta-btn" data-action="clear-filters" type="button">Reset Filters</button>
    </div>
  `;
}

function renderSkeletonTable() {
  const body = dom.byId("requestsTableBody");
  if (!body) return;

  body.innerHTML = `
    <tr>
      <td colspan="4">
        <div class="skeleton-row">
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line"></div>
        </div>
      </td>
    </tr>
  `;
}

function renderTable() {
  const body = dom.byId("requestsTableBody");
  if (!body) return;

  if (state.loading) {
    renderSkeletonTable();
    return;
  }

  const filtered = getFilteredRequests(state.requests);

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty">${buildEmptyStateHtml()}</td></tr>`;
    return;
  }

  body.innerHTML = filtered.map((item) => {
    const canCancel = item.status === "Pending";
    return `
      <tr>
        <td>${escapeHtml(item.type)}</td>
        <td><span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(formatDateDisplay(item.submittedAt || item.date))}</td>
        <td class="actions-cell">
          <div class="row-actions">
            <button class="row-action-btn primary" data-action="details" data-id="${item.id}" type="button">Details</button>
            <button class="row-action-btn" data-action="receipt" data-id="${item.id}" type="button">Receipt</button>
            <button class="row-action-btn warning" data-action="cancel" data-id="${item.id}" type="button" ${canCancel ? "" : "disabled"}>Cancel</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderQuickChips() {
  dom.qsa(".quick-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.chip === state.activeQuickChip);
  });
}

function renderNotifFilterButtons() {
  dom.qsa(".notif-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.notifFilter === state.activeNotifFilter);
  });
}

function renderAll() {
  applyBranding();
  renderTypeFilterOptions();
  renderCounts();
  renderNotifFilterButtons();
  renderNotifications();
  renderActivity();
  renderProfileCompletion();
  renderQuickChips();
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
async function downloadReceipt(requestId) {
  let token = apiClient.getSession().accessToken;

  const doFetch = () => fetch(`${apiClient.apiBaseUrl}/requests/${requestId}/receipt`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  let response = await doFetch();

  if (response.status === 401 && apiClient.getSession().refreshToken) {
    try {
      await apiClient.refreshAccessToken();
      token = apiClient.getSession().accessToken;
      response = await doFetch();
    } catch (_err) {
      apiClient.clearSession();
      window.location.href = "index.html";
      return;
    }
  }

  if (!response.ok) {
    let message = "Failed to download receipt.";
    try {
      const errorPayload = await response.json();
      if (errorPayload && errorPayload.message) message = errorPayload.message;
    } catch (_err) {
      // keep fallback error message
    }
    throw new Error(message);
  }

  const text = await response.text();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `request-${requestId}-receipt.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filterByStatus(status, cardId) {
  state.activeStatusFilter = status;
  const statusFilter = dom.byId("statusFilter");
  if (statusFilter) statusFilter.value = "";

  if (cardId) {
    setActiveCard(cardId);
  } else {
    clearActiveCards();
  }

  updateTableTitle();
  renderTable();
}

function setQuickChip(chip) {
  state.activeQuickChip = chip;

  if (chip === "pending") {
    state.activeStatusFilter = "Pending";
    setActiveCard("pendingCard");
    const statusFilter = dom.byId("statusFilter");
    if (statusFilter) statusFilter.value = "";
  } else if (chip === "approved") {
    state.activeStatusFilter = "Approved";
    setActiveCard("approvedCard");
    const statusFilter = dom.byId("statusFilter");
    if (statusFilter) statusFilter.value = "";
  } else if (chip === "all") {
    state.activeStatusFilter = "";
    setActiveCard("allCard");
    const statusFilter = dom.byId("statusFilter");
    if (statusFilter) statusFilter.value = "";
  }

  if (chip === "thisWeek" || chip === "needsAction") {
    clearActiveCards();
    const statusFilter = dom.byId("statusFilter");
    if (statusFilter) statusFilter.value = "";
    state.activeStatusFilter = "";
  }

  renderQuickChips();
  updateTableTitle();
  renderTable();
}

function resetAllFilters() {
  const search = dom.byId("searchInput");
  const type = dom.byId("typeFilter");
  const status = dom.byId("statusFilter");
  const date = dom.byId("dateFilter");

  if (search) search.value = "";
  if (type) type.value = "";
  if (status) status.value = "";
  if (date) date.value = "";

  state.activeStatusFilter = "";
  state.activeQuickChip = "all";

  setActiveCard("allCard");
  renderQuickChips();
  updateTableTitle();
  renderTable();
}

function closeRequestTypeModal() {
  state.selectedRequestType = "";
  dom.qsa(".request-type-btn").forEach((button) => button.classList.remove("request-type-selected"));
  const confirmBtn = dom.byId("confirmRequestTypeBtn");
  if (confirmBtn) confirmBtn.disabled = true;

  const modal = dom.byId("requestTypeModal");
  if (modal) modal.classList.remove("show");
}

function openRequestTypeModal() {
  renderRequestTypeButtons();
  state.selectedRequestType = "";
  dom.qsa(".request-type-btn").forEach((button) => button.classList.remove("request-type-selected"));

  const confirmBtn = dom.byId("confirmRequestTypeBtn");
  if (confirmBtn) confirmBtn.disabled = true;

  const modal = dom.byId("requestTypeModal");
  if (modal) modal.classList.add("show");
}

function selectRequestType(requestType, buttonElement) {
  state.selectedRequestType = requestType;
  dom.qsa(".request-type-btn").forEach((button) => button.classList.remove("request-type-selected"));
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
  const request = state.requests.find((item) => String(item.id) === String(requestId));
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
    await refreshDashboard();
    closeCancelConfirmModal();
  } catch (err) {
    window.alert(err.message || "Failed to cancel request.");
  }
}

function closeClearConfirmModal() {
  state.pendingClearCount = 0;
  const modal = dom.byId("clearConfirmModal");
  if (modal) modal.classList.remove("show");
}

function promptClearNonPending() {
  const removableCount = state.requests.filter((item) => item.status !== "Pending").length;

  if (!removableCount) {
    window.alert("No non-pending requests to clear.");
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
    closeClearConfirmModal();
    await refreshDashboard();
  } catch (err) {
    window.alert(err.message || "Failed to clear requests.");
  }
}

function toggleNotificationsPanel() {
  const panel = dom.byId("notificationPanel");
  if (!panel) return;
  panel.classList.toggle("show-panel");
}

async function markAllNotificationsRead() {
  try {
    await api.markNotificationsRead();
    state.notifications = state.notifications.map((item) => ({ ...item, read: true }));
    clearNotifReadOverrides();
    renderNotifications();
  } catch (err) {
    window.alert(err.message || "Failed to mark notifications read.");
  }
}

function setNotificationFilter(filter) {
  state.activeNotifFilter = filter;
  renderNotifFilterButtons();
  renderNotifications();
}

function toggleNotificationRead(notificationId) {
  const row = state.notifications.find((item) => String(item.id) === String(notificationId));
  if (!row) return;
  const effective = getNotifEffectiveState(row);
  setNotifReadState(notificationId, !effective.read);
  renderNotifications();
}

function toggleNotificationArchive(notificationId) {
  const row = state.notifications.find((item) => String(item.id) === String(notificationId));
  if (!row) return;
  const effective = getNotifEffectiveState(row);
  setNotifArchived(notificationId, !effective.archived);
  renderNotifications();
}

function buildRequestTimeline(request) {
  const timeline = [
    {
      label: "Request submitted",
      date: request.submittedAt || request.date
    }
  ];

  if (request.status === "Pending") {
    timeline.push({
      label: "Pending barangay review",
      date: request.updatedAt || request.submittedAt || request.date
    });
    return timeline;
  }

  timeline.push({
    label: `Status changed to ${request.status}`,
    date: request.updatedAt || request.submittedAt || request.date
  });

  if (request.status === "Rejected") {
    timeline.push({
      label: "Please file a new request with corrected details",
      date: request.updatedAt || request.submittedAt || request.date
    });
  }

  return timeline;
}

function openRequestDetails(requestId) {
  const request = state.requests.find((item) => String(item.id) === String(requestId));
  if (!request) return;

  state.selectedDetailsRequestId = request.id;

  const detailsContent = dom.byId("requestDetailsContent");
  const timelineList = dom.byId("requestTimeline");
  if (!detailsContent || !timelineList) return;

  const details = [
    { label: "Request ID", value: request.id },
    { label: "Document Type", value: request.type || "-" },
    { label: "Status", value: request.status || "-" },
    { label: "Submitted", value: formatDateTimeDisplay(request.submittedAt || request.date) },
    { label: "Last Updated", value: formatDateTimeDisplay(request.updatedAt || request.submittedAt || request.date) },
    { label: "Address", value: request.address || "-" },
    { label: "Contact", value: request.contact || "-" },
    { label: "Purpose", value: request.purpose || "-" }
  ];

  detailsContent.innerHTML = details.map((item) => `
    <div class="details-item">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");

  const timeline = buildRequestTimeline(request);
  timelineList.innerHTML = timeline.map((item) => `
    <li>
      ${escapeHtml(item.label)}
      <small>${escapeHtml(formatDateTimeDisplay(item.date))}</small>
    </li>
  `).join("");

  const modal = dom.byId("requestDetailsModal");
  if (modal) modal.classList.add("show");
}

function closeRequestDetailsModal() {
  state.selectedDetailsRequestId = null;
  const modal = dom.byId("requestDetailsModal");
  if (modal) modal.classList.remove("show");
}

async function downloadSelectedDetailsReceipt() {
  if (!state.selectedDetailsRequestId) return;
  try {
    await downloadReceipt(state.selectedDetailsRequestId);
  } catch (err) {
    window.alert(err.message || "Failed to download receipt.");
  }
}

async function confirmLogout() {
  try {
    await api.logout();
  } catch (_err) {
    // keep logout UX smooth even if API call fails
  } finally {
    apiClient.clearSession();
    window.location.href = "index.html";
  }
}

async function refreshDashboard() {
  try {
    state.loading = true;
    renderTable();
    hideBanner();

    const loaded = await api.loadDashboardData();
    if (!loaded) return;

    state.loading = false;
    renderAll();
  } catch (err) {
    state.loading = false;
    renderAll();
    showBanner(err.message || "Failed to load dashboard data.", true);
  }
}
function bindEvents() {
  dom.bindClick("notificationBtn", toggleNotificationsPanel);
  dom.bindClick("markAllReadBtn", markAllNotificationsRead);

  dom.qsa(".notif-filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      setNotificationFilter(this.dataset.notifFilter || "all");
    });
  });

  dom.bindClick("navNewRequest", function (event) {
    event.preventDefault();
    openRequestTypeModal();
  });

  dom.bindClick("heroNewRequestBtn", function () {
    openRequestTypeModal();
  });

  dom.bindClick("navSettings", function () {
    window.location.href = "user-settings.html";
  });

  dom.bindClick("navAboutUs", function () {
    window.location.href = "aboutus.html";
  });

  dom.bindClick("navLogout", confirmLogout);

  dom.bindClick("clearFiltersBtn", resetAllFilters);
  dom.bindClick("clearHistoryBtn", promptClearNonPending);

  dom.bindClick("closeRequestTypeBtn", closeRequestTypeModal);
  dom.bindClick("confirmRequestTypeBtn", confirmRequestTypeSelection);

  dom.bindClick("cancelConfirmNoBtn", closeCancelConfirmModal);
  dom.bindClick("cancelConfirmYesBtn", confirmCancelRequest);

  dom.bindClick("clearConfirmNoBtn", closeClearConfirmModal);
  dom.bindClick("clearConfirmYesBtn", confirmClearNonPending);

  dom.bindClick("detailsCloseBtn", closeRequestDetailsModal);
  dom.bindClick("detailsReceiptBtn", downloadSelectedDetailsReceipt);

  dom.bindClick("dashboardRetryBtn", refreshDashboard);

  const allCard = dom.byId("allCard");
  if (allCard) {
    allCard.addEventListener("click", function () {
      state.activeQuickChip = "all";
      renderQuickChips();
      filterByStatus("", "allCard");
    });
  }

  const pendingCard = dom.byId("pendingCard");
  if (pendingCard) {
    pendingCard.addEventListener("click", function () {
      state.activeQuickChip = "pending";
      renderQuickChips();
      filterByStatus("Pending", "pendingCard");
    });
  }

  const approvedCard = dom.byId("approvedCard");
  if (approvedCard) {
    approvedCard.addEventListener("click", function () {
      state.activeQuickChip = "approved";
      renderQuickChips();
      filterByStatus("Approved", "approvedCard");
    });
  }

  dom.qsa(".quick-chip").forEach((chip) => {
    chip.addEventListener("click", function () {
      setQuickChip(this.dataset.chip || "all");
    });
  });

  const searchInput = dom.byId("searchInput");
  if (searchInput) searchInput.addEventListener("input", renderTable);

  const typeFilter = dom.byId("typeFilter");
  if (typeFilter) typeFilter.addEventListener("change", renderTable);

  const statusFilter = dom.byId("statusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", function () {
      state.activeStatusFilter = "";
      state.activeQuickChip = "all";
      clearActiveCards();
      renderQuickChips();
      updateTableTitle();
      renderTable();
    });
  }

  const dateFilter = dom.byId("dateFilter");
  if (dateFilter) dateFilter.addEventListener("change", renderTable);

  const requestsTableBody = dom.byId("requestsTableBody");
  if (requestsTableBody) {
    requestsTableBody.addEventListener("click", async function (event) {
      const actionNode = event.target.closest("[data-action]");
      if (!actionNode) return;

      const action = actionNode.dataset.action;
      const requestId = actionNode.dataset.id;

      if (action === "cancel") {
        cancelRequest(requestId);
        return;
      }

      if (action === "details") {
        openRequestDetails(requestId);
        return;
      }

      if (action === "receipt") {
        try {
          await downloadReceipt(requestId);
        } catch (err) {
          window.alert(err.message || "Failed to download receipt.");
        }
        return;
      }

      if (action === "open-request-type") {
        openRequestTypeModal();
        return;
      }

      if (action === "clear-filters") {
        resetAllFilters();
      }
    });
  }

  const notificationList = dom.byId("notificationList");
  if (notificationList) {
    notificationList.addEventListener("click", function (event) {
      const btn = event.target.closest("button[data-notif-action]");
      if (!btn) return;

      const notifAction = btn.dataset.notifAction;
      const notifId = btn.dataset.id;

      if (notifAction === "toggle-read") {
        toggleNotificationRead(notifId);
        return;
      }

      if (notifAction === "toggle-archive") {
        toggleNotificationArchive(notifId);
      }
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

  const requestDetailsModal = dom.byId("requestDetailsModal");
  if (requestDetailsModal) {
    requestDetailsModal.addEventListener("click", function (event) {
      if (event.target.id === "requestDetailsModal") closeRequestDetailsModal();
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
  setActiveCard("allCard");
  renderTable();
  bindEvents();
  await refreshDashboard();
}

init();
