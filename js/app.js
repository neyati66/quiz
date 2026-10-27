// ============================================================
// app.js — common bootstrap run on every page.
// ============================================================

function showPremiumModal(onCancel) {
  Notify.showModal({
    title: "🔒 Premium Test",
    bodyHTML: "Test 3 is available with Premium.<br><br>Unlock advanced questions, adaptive practice and more.",
    buttons: [
      { label: "Cancel", className: "btn btn-ghost", onClick: onCancel },
      {
        label: "Join / Subscribe", className: "btn btn-accent", onClick: () => {
          Notify.showInfo("Subscriptions aren't connected to real payments in this build — no charge was made.");
        },
      },
    ],
  });
}

function syncAuthNav() {
  const user = Auth.currentUser();
  // Top public nav (index.html style pages): a.btn with text "Sign in"
  document.querySelectorAll("a.btn").forEach((a) => {
    const t = a.textContent.trim();
    if (t === "Sign in") {
      if (user) { a.textContent = "Dashboard"; a.setAttribute("href", "./dashboard.html"); }
    }
  });
  // Sidebar "Sign out" links -> wire to Auth.logout with confirmation, and show real name if a slot exists.
  document.querySelectorAll(".side nav a, header.nav a").forEach((a) => {
    if (a.textContent.trim() === "Sign out") {
      a.addEventListener("click", (e) => { e.preventDefault(); Auth.logout(a.getAttribute("href") || "./login.html"); });
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  Theme.init();
  syncAuthNav();
  Auth.consumeFlash();
});
