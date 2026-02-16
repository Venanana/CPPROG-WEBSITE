const recoveryForm = document.getElementById("recoveryForm");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const emailInput = document.getElementById("emailInput");
const verifySection = document.getElementById("verifySection");
const codeInput = document.getElementById("codeInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const statusMessage = document.getElementById("statusMessage");
const demoCodeRow = document.getElementById("demoCodeRow");
const demoCodeText = document.getElementById("demoCodeText");
const successModal = document.getElementById("successModal");
const backToLoginBtn = document.getElementById("backToLoginBtn");

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

sendCodeBtn.addEventListener("click", async function () {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    showStatus("Please enter your email address.", "error");
    return;
  }

  try {
    const payload = await apiClient.post("/auth/forgot-password", { email }, { auth: false });
    verifySection.classList.remove("hidden");
    showStatus(payload.message || "Verification code sent.", "success");

    if (payload.debugCode) {
      demoCodeRow.classList.remove("hidden");
      demoCodeText.textContent = payload.debugCode;
    } else {
      demoCodeRow.classList.add("hidden");
    }
  } catch (err) {
    showStatus(err.message || "Could not send reset code.", "error");
  }
});

recoveryForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const code = codeInput.value.trim();
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (newPassword !== confirmPassword) {
    showStatus("Passwords do not match.", "error");
    return;
  }

  try {
    const verifyPayload = await apiClient.post("/auth/verify-reset-code", { email, code }, { auth: false });
    await apiClient.post("/auth/reset-password", {
      resetToken: verifyPayload.resetToken,
      newPassword
    }, { auth: false });

    showStatus("");
    demoCodeRow.classList.add("hidden");
    successModal.classList.add("show");
  } catch (err) {
    showStatus(err.message || "Password reset failed.", "error");
  }
});

backToLoginBtn.addEventListener("click", function () {
  window.location.href = "index.html";
});

loadBranding();
