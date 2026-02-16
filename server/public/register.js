const registerForm = document.getElementById("registerForm");
const statusMessage = document.getElementById("statusMessage");

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type || ""}`.trim();
}

function applyBranding(settings) {
  const branding = settings && settings.branding ? settings.branding : {};
  const title = branding.systemName || "BARANGAY REQUEST SYSTEM";
  const logo = branding.logo || "barangay-logo.jpg";
  document.querySelector(".brand h1").textContent = title;
  document.querySelector(".brand img").src = logo;
}

async function loadBranding() {
  try {
    const data = await apiClient.get("/public/settings", { auth: false });
    applyBranding(data.settings);
  } catch (_err) {
    applyBranding(null);
  }
}

registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const contact = document.getElementById("contact").value.trim();
  const dob = document.getElementById("dob").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const agree = document.getElementById("agree").checked;

  if (!agree) {
    showStatus("Please confirm the information before registering.", "error");
    return;
  }
  if (password !== confirmPassword) {
    showStatus("Passwords do not match.", "error");
    return;
  }
  if (contact && !/^09\d{9}$/.test(contact)) {
    showStatus("Contact number must use 09XXXXXXXXX format.", "error");
    return;
  }

  try {
    const payload = await apiClient.post("/auth/register", {
      username,
      email,
      password,
      fullName,
      contact,
      dob
    }, { auth: false });

    apiClient.setSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user
    });

    showStatus("Account created successfully. Redirecting to sign in...", "success");
    window.setTimeout(function () {
      apiClient.clearSession();
      window.location.href = "index.html";
    }, 900);
  } catch (err) {
    showStatus(err.message || "Registration failed.", "error");
  }
});

loadBranding();
