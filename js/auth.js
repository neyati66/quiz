// ============================================================
// auth.js — Phase 2: server-verified authentication (bcrypt hashes in MongoDB,
// JWT issued by Express). Public method names/return values are unchanged from
// Phase 1 so signup.js / login.js / app.js and every protected page keep working.
// ============================================================

const Auth = (() => {
  function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  async function signup(name, email, password, confirm) {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    if (!name || !email || !password) { Notify.showError("Please fill in all fields."); return false; }
    if (!isValidEmail(email)) { Notify.showError("That email address doesn't look valid."); return false; }
    if (password.length < 6) { Notify.showError("Password must be at least 6 characters."); return false; }
    if (confirm !== undefined && confirm !== password) { Notify.showError("Passwords do not match."); return false; }
    try {
      await Api.register(name, email, password); // server always creates a STUDENT account
    } catch (e) {
      Notify.showError(e.code === "EMAIL_TAKEN" ? "An account with this email already exists." : Api.messageOf(e));
      return false;
    }
    // Per the required flow: Signup does NOT log the user in automatically.
    Notify.showSuccess(`Account created successfully. Please log in, ${name}.`);
    return true;
  }

  async function login(email, password) {
    email = (email || "").trim().toLowerCase();
    if (!email || !password) { Notify.showError("Please enter both email and password."); return false; }
    try {
      const d = await Api.login(email, password);
      Api.setSession(d.token, d.user);
      Notify.showSuccess(`Welcome back, ${d.user.name}!`);
      return true;
    } catch (e) {
      Notify.showError(e.code === "BAD_CREDENTIALS" ? "Incorrect email or password." : Api.messageOf(e));
      return false;
    }
  }

  // JWTs are stateless: "logout" = the browser forgets the token (it also expires on its own).
  function logout(redirect = "./login.html") {
    Notify.showConfirmation("You will be signed out of Quizzy on this device.", () => {
      Storage.clearSession();
      Notify.showInfo("You have been signed out.");
      setTimeout(() => { window.location.href = redirect; }, 500);
    }, { title: "Sign out?", confirmLabel: "Sign out" });
  }

  function currentUser() {
    if (!Api.getToken()) return null;
    const u = Api.getUser();
    return u ? { name: u.name, email: u.email, role: u.role } : null;
  }

  // Call at the top of any protected page. (The server re-checks the token on every API call.)
  function requireAuth() {
    const user = currentUser();
    if (!user) {
      sessionStorage.setItem("quizzy_flash", "Please login to continue.");
      window.location.href = "./login.html";
      return null;
    }
    return user;
  }

  function consumeFlash() {
    const msg = sessionStorage.getItem("quizzy_flash");
    if (msg) { sessionStorage.removeItem("quizzy_flash"); Notify.showWarning(msg); }
  }

  return { signup, login, logout, currentUser, requireAuth, consumeFlash, isValidEmail };
})();
