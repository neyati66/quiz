// Login → on success, return to the LANDING PAGE (not the dashboard),
// per the required auth flow.
(function () {
  if (Auth.currentUser()) { window.location.href = "./index.html"; return; }
  const form = document.querySelector(".auth-card");
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const submitBtn = Array.from(form.querySelectorAll("button")).find((b) => b.textContent.trim() === "Sign in");

  // NEW: inline validation wiring (added — does not change Auth.login itself).
  if (window.Validation) {
    Validation.attachLiveValidation(emailInput, Validation.validateEmailField);
    Validation.attachLiveValidation(passInput, Validation.validateLoginPasswordField);
  }

  function runValidation() {
    if (!window.Validation) return true;
    const validEmail = Validation.validateEmailField(emailInput);
    const validPassword = Validation.validateLoginPasswordField(passInput);
    return validEmail && validPassword;
  }

  async function doLogin(e) {
    if (e) e.preventDefault();
    if (!runValidation()) return;
    const ok = await Auth.login(emailInput.value, passInput.value);
    if (ok) setTimeout(() => { window.location.href = "./index.html"; }, 400);
  }
  form.addEventListener("submit", doLogin);
  if (submitBtn) submitBtn.addEventListener("click", doLogin);
})();
