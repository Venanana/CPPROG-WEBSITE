const profileForm = document.getElementById("profileForm");
const passwordForm = document.getElementById("passwordForm");
const prefsForm = document.getElementById("prefsForm");
const historyBody = document.getElementById("historyBody");

let currentUser = null;
let requests = [];

function showStatus(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `status ${type || ""}`.trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyBranding(settings) {
  const branding = settings && settings.branding ? settings.branding : {};
  document.getElementById("systemTitle").textContent = branding.systemName || "BARANGAY REQUEST SYSTEM";
  document.getElementById("brandLogo").src = branding.logo || "barangay-logo.jpg";
}

function setAvatar(imageSrc) {
  const avatarPreview = document.getElementById("avatarPreview");
  const avatarFallback = document.getElementById("avatarFallback");
  if (imageSrc) {
    avatarPreview.src = imageSrc;
    avatarPreview.style.display = "block";
    avatarFallback.style.display = "none";
  } else {
    avatarPreview.removeAttribute("src");
    avatarPreview.style.display = "none";
    avatarFallback.style.display = "inline-flex";
  }
}

function statusClass(status) {
  return `status-badge status-${String(status || "").toLowerCase()}`;
}

function fillProfileForm(user) {
  document.getElementById("fullName").value = user.fullName || "";
  document.getElementById("username").value = user.username || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("contact").value = user.contact || "";
  document.getElementById("address").value = user.address || "";
  document.getElementById("photoUrl").value = user.avatarUrl || "";
  setAvatar(user.avatarUrl || "");
}

function fillPreferences(user) {
  const prefs = user.preferences || {};
  document.getElementById("inAppNotif").checked = prefs.inApp !== false;
  document.getElementById("emailNotif").checked = !!prefs.email;
}

function renderHistory() {
  if (!requests.length) {
    historyBody.innerHTML = "<tr><td colspan='4' class='empty'>No request history found.</td></tr>";
    return;
  }

  historyBody.innerHTML = requests.map(row => `
    <tr>
      <td>${escapeHtml(row.type || "-")}</td>
      <td><span class="${statusClass(row.status)}">${escapeHtml(row.status || "-")}</span></td>
      <td>${escapeHtml(row.date || "-")}</td>
      <td><button class="receipt-btn" data-id="${escapeHtml(row.id)}" type="button">Download Receipt</button></td>
    </tr>
  `).join("");
}

async function reloadData() {
  const [settingsPayload, mePayload, requestsPayload] = await Promise.all([
    apiClient.get("/public/settings", { auth: false }),
    apiClient.get("/users/me"),
    apiClient.get("/requests/me")
  ]);

  currentUser = mePayload.user || currentUser;
  requests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
  applyBranding(settingsPayload.settings || {});
  fillProfileForm(currentUser || {});
  fillPreferences(currentUser || {});
  renderHistory();
}

profileForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const contact = document.getElementById("contact").value.trim();
  const address = document.getElementById("address").value.trim();
  const avatarUrl = document.getElementById("photoUrl").value.trim();

  if (!fullName) {
    showStatus("profileStatus", "Full name is required.", "error");
    return;
  }
  if (contact && !/^09\d{9}$/.test(contact)) {
    showStatus("profileStatus", "Contact number must use 09XXXXXXXXX format.", "error");
    return;
  }

  try {
    const payload = await apiClient.patch("/users/me", {
      fullName,
      email,
      contact,
      address,
      avatarUrl
    });
    currentUser = payload.user || currentUser;
    apiClient.setSession({ user: currentUser });
    setAvatar(currentUser.avatarUrl || "");
    showStatus("profileStatus", "Profile saved successfully.", "success");
  } catch (err) {
    showStatus("profileStatus", err.message || "Failed to save profile.", "error");
  }
});

passwordForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (newPassword !== confirmPassword) {
    showStatus("passwordStatus", "Password confirmation does not match.", "error");
    return;
  }

  try {
    await apiClient.patch("/users/me/password", { currentPassword, newPassword });
    passwordForm.reset();
    showStatus("passwordStatus", "Password updated.", "success");
  } catch (err) {
    showStatus("passwordStatus", err.message || "Failed to update password.", "error");
  }
});

prefsForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const inApp = document.getElementById("inAppNotif").checked;
  const email = document.getElementById("emailNotif").checked;

  try {
    const payload = await apiClient.patch("/users/me/preferences", { inApp, email });
    currentUser = payload.user || currentUser;
    apiClient.setSession({ user: currentUser });
    showStatus("prefsStatus", "Notification preferences saved.", "success");
  } catch (err) {
    showStatus("prefsStatus", err.message || "Failed to save preferences.", "error");
  }
});

document.getElementById("photoFile").addEventListener("change", function () {
  const file = this.files && this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    const base64 = String(reader.result || "");
    document.getElementById("photoUrl").value = base64;
    setAvatar(base64);
  };
  reader.readAsDataURL(file);
});

document.getElementById("photoUrl").addEventListener("input", function () {
  if (!document.getElementById("photoFile").files.length) {
    setAvatar(this.value.trim());
  }
});

historyBody.addEventListener("click", async function (event) {
  const button = event.target.closest("button.receipt-btn");
  if (!button) return;

  const id = button.getAttribute("data-id");
  const token = apiClient.getSession().accessToken;
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    const response = await fetch(`${apiClient.apiBaseUrl}/requests/${id}/receipt`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await response.text();
    if (!response.ok) throw new Error("Could not download receipt.");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const fileName = `receipt-${id}.txt`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    window.alert(err.message || "Could not download receipt.");
  }
});

currentUser = apiClient.requireAuth(["user"]);
if (currentUser) {
  reloadData().catch(function (err) {
    window.alert(err.message || "Failed to load user settings.");
  });
}
