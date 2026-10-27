// ============================================================
// theme.js — dark mode toggle, persisted in localStorage,
// applied on every page load (works for dynamically created content
// too, since it's a CSS variable swap on <html>, not per-element).
// ============================================================

const Theme = (() => {
  const KEY = "quizzy_theme_v1";

  function get() { return localStorage.getItem(KEY) || "light"; }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function init() {
    apply(get());
    injectToggle();
  }

  function toggle() {
    const next = get() === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
    Notify.showInfo(next === "dark" ? "Dark mode enabled" : "Light mode enabled");
    syncToggleIcon();
  }

  function syncToggleIcon() {
    const btn = document.getElementById("qz-theme-toggle");
    if (btn) btn.textContent = get() === "dark" ? "☀️" : "🌙";
  }

  function injectToggle() {
    if (document.getElementById("qz-theme-toggle")) { syncToggleIcon(); return; }
    const btn = document.createElement("button");
    btn.id = "qz-theme-toggle";
    btn.type = "button";
    btn.title = "Toggle dark mode";
    btn.className = "btn btn-ghost btn-sm";
    btn.style.cssText = "margin-left:8px;padding:8px 11px;";
    btn.textContent = get() === "dark" ? "☀️" : "🌙";
    btn.addEventListener("click", toggle);

    // Prefer placing it next to the nav links / sidebar nav so it inherits existing styles.
    const navLinks = document.querySelector(".nav-links");
    const sideNav = document.querySelector(".side nav");
    const authForm = document.querySelector(".auth-form .brand, .auth-card");
    if (navLinks) navLinks.insertAdjacentElement("afterend", btn);
    else if (sideNav) sideNav.appendChild(btn);
    else if (authForm) authForm.parentElement.appendChild(btn);
    else document.body.appendChild(btn);
  }

  return { init, toggle, get };
})();
