(function attachPasswordToggles() {
  function setButtonState(button, input) {
    const icon = button.querySelector("i");
    const visible = input.type === "text";
    button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    button.setAttribute("title", visible ? "Hide password" : "Show password");
    if (!icon) return;
    icon.classList.toggle("fa-eye", !visible);
    icon.classList.toggle("fa-eye-slash", visible);
  }

  document.querySelectorAll(".password-toggle-btn").forEach(function (button) {
    const targetId = button.getAttribute("data-target");
    const input = targetId ? document.getElementById(targetId) : null;
    if (!input) return;

    setButtonState(button, input);
    button.addEventListener("click", function () {
      input.type = input.type === "password" ? "text" : "password";
      setButtonState(button, input);
    });
  });
})();
