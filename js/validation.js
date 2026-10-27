// ============================================================
// validation.js — NEW, ADDITIVE MODULE ONLY.
// Generic client-side form validation helpers (required fields,
// email format, strong password, confirm-password match) that
// render inline red error text under each input. This module does
// not read/write quiz, SM-2 or auth/session data — it only helps
// login.html / signup.html validate before calling the existing
// Auth.signup / Auth.login functions, which are left untouched.
// ============================================================

const Validation = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function isValidEmail(email) {
    return EMAIL_RE.test((email || "").trim());
  }

  function passwordStrength(password) {
    password = password || "";
    const checks = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
    const valid = Object.values(checks).every(Boolean);
    return {
      valid,
      checks,
      message: "Password must contain at least 8 characters, including uppercase, lowercase, number and special character.",
    };
  }

  function errorElFor(inputEl) {
    return document.getElementById(inputEl.id + "-error");
  }

  function showFieldError(inputEl, message) {
    const errEl = errorElFor(inputEl);
    if (errEl) { errEl.textContent = message; errEl.classList.add("show"); }
    const field = inputEl.closest(".field");
    if (field) field.classList.add("has-error");
  }

  function clearFieldError(inputEl) {
    const errEl = errorElFor(inputEl);
    if (errEl) { errEl.textContent = ""; errEl.classList.remove("show"); }
    const field = inputEl.closest(".field");
    if (field) field.classList.remove("has-error");
  }

  // Validates a single required text/email field. Returns true if valid.
  function validateRequired(inputEl, label) {
    const value = (inputEl.value || "").trim();
    if (!value) { showFieldError(inputEl, "This field is required."); return false; }
    clearFieldError(inputEl);
    return true;
  }

  function validateEmailField(inputEl) {
    const value = (inputEl.value || "").trim();
    if (!value) { showFieldError(inputEl, "This field is required."); return false; }
    if (!isValidEmail(value)) { showFieldError(inputEl, "Please enter a valid email address."); return false; }
    clearFieldError(inputEl);
    return true;
  }

  function validatePasswordField(inputEl) {
    const value = inputEl.value || "";
    if (!value) { showFieldError(inputEl, "This field is required."); return false; }
    const result = passwordStrength(value);
    if (!result.valid) { showFieldError(inputEl, result.message); return false; }
    clearFieldError(inputEl);
    return true;
  }

  // Password field used for login: required only, not required to be "strong"
  // (an existing account may predate this rule) — matches login behavior.
  function validateLoginPasswordField(inputEl) {
    return validateRequired(inputEl, "Password");
  }

  function validateConfirmField(confirmEl, passwordEl) {
    const value = confirmEl.value || "";
    if (!value) { showFieldError(confirmEl, "This field is required."); return false; }
    if (value !== (passwordEl.value || "")) { showFieldError(confirmEl, "Passwords do not match."); return false; }
    clearFieldError(confirmEl);
    return true;
  }

  // Wires blur + input live-validation for a field, using the given validator.
  function attachLiveValidation(inputEl, validatorFn) {
    if (!inputEl) return;
    inputEl.addEventListener("blur", () => validatorFn(inputEl));
    inputEl.addEventListener("input", () => {
      const field = inputEl.closest(".field");
      if (field && field.classList.contains("has-error")) validatorFn(inputEl);
    });
  }

  return {
    isValidEmail, passwordStrength,
    showFieldError, clearFieldError,
    validateRequired, validateEmailField, validatePasswordField,
    validateLoginPasswordField, validateConfirmField,
    attachLiveValidation,
  };
})();
