const userLoginForm = document.getElementById("userLoginForm");
const adminLoginForm = document.getElementById("adminLoginForm");

function applyBranding(settings) {
  const branding = settings && settings.branding ? settings.branding : {};
  const title = branding.systemName || "BARANGAY REQUEST SYSTEM";
  const logo = branding.logo || "barangay-logo.jpg";
  document.getElementById("systemTitle").textContent = title;
  document.querySelector(".header-logo").src = logo;
}

async function loadBranding() {
  try {
    const data = await apiClient.get("/public/settings", { auth: false });
    applyBranding(data.settings);
  } catch (_err) {
    applyBranding(null);
  }
}

async function loginAs(role, username, password) {
  const payload = await apiClient.post("/auth/login", { username, password }, { auth: false });
  if (!payload.user || payload.user.role !== role) {
    throw new Error(role === "admin" ? "This account is not an admin account." : "This account is not a user account.");
  }
  apiClient.setSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user
  });
}

userLoginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const username = document.getElementById("userUsername").value.trim();
  const password = document.getElementById("userPassword").value;

  try {
    await loginAs("user", username, password);
    window.location.href = "landingpage.html";
  } catch (err) {
    window.alert(err.message || "User sign-in failed.");
  }
});

adminLoginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value;

  try {
    await loginAs("admin", username, password);
    window.location.href = "admin-dashboard.html";
  } catch (err) {
    window.alert(err.message || "Admin sign-in failed.");
  }
});

loadBranding();
