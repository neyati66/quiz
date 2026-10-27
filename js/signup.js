// Signup → does NOT log the user in and does NOT start a test.
// It sends them to the Login page, per the required auth flow.
(function () {
  if (Auth.currentUser()) { window.location.href = "./index.html"; return; }
  const form = document.querySelector(".auth-card");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const submitBtn = Array.from(form.querySelectorAll("button")).find((b) => b.textContent.trim() === "Create free account");

  // NEW: inline validation wiring (added — does not change Auth.signup itself).
  if (window.Validation) {
    Validation.attachLiveValidation(nameInput, (el) => Validation.validateRequired(el, "Full name"));
    Validation.attachLiveValidation(emailInput, Validation.validateEmailField);
    Validation.attachLiveValidation(passInput, Validation.validatePasswordField);
    if (confirmInput) {
      Validation.attachLiveValidation(confirmInput, (el) => Validation.validateConfirmField(el, passInput));
      // Re-check confirm field if the user edits the password afterwards.
      passInput.addEventListener("input", () => {
        if (confirmInput.value) Validation.validateConfirmField(confirmInput, passInput);
      });
    }
  }

  function runValidation() {
    if (!window.Validation) return true;
    const validName = Validation.validateRequired(nameInput, "Full name");
    const validEmail = Validation.validateEmailField(emailInput);
    const validPassword = Validation.validatePasswordField(passInput);
    const validConfirm = confirmInput ? Validation.validateConfirmField(confirmInput, passInput) : true;
    return validName && validEmail && validPassword && validConfirm;
  }

  async function doSignup(e) {
    if (e) e.preventDefault();
    if (!runValidation()) return;
    const ok = await Auth.signup(nameInput.value, emailInput.value, passInput.value, confirmInput ? confirmInput.value : undefined);
    if (ok) setTimeout(() => { window.location.href = "./login.html"; }, 700);
  }
  form.addEventListener("submit", doSignup);
  if (submitBtn) submitBtn.addEventListener("click", doSignup);
})();
