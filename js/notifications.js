// ============================================================
// notifications.js — reusable toast + modal system
// showSuccess / showError / showWarning / showInfo / showConfirmation / showModal
// ============================================================

const Notify = (() => {
  function ensureToastHost() {
    let host = document.getElementById("qz-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "qz-toast-host";
      host.style.cssText = "position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;";
      document.body.appendChild(host);
    }
    return host;
  }

  const COLORS = {
    success: "#2f9e6f", error: "#d64545", warning: "#c98a1f", info: "#3f5fce",
  };

  function toast(message, type = "info", timeout = 3800) {
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = `background:#20222b;color:#fff;padding:12px 18px;border-radius:10px;
      font:600 13.5px/1.4 -apple-system,Segoe UI,Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);
      border-left:4px solid ${COLORS[type] || COLORS.info};opacity:0;transform:translateY(10px);
      transition:.25s;max-width:360px;`;
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    setTimeout(() => {
      el.style.opacity = "0"; el.style.transform = "translateY(10px)";
      setTimeout(() => el.remove(), 250);
    }, timeout);
  }

  const showSuccess = (m) => toast(m, "success");
  const showError = (m) => toast(m, "error");
  const showWarning = (m) => toast(m, "warning");
  const showInfo = (m) => toast(m, "info");

  function ensureModalHost() {
    let host = document.getElementById("qz-modal-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "qz-modal-host";
      document.body.appendChild(host);
    }
    return host;
  }

  // Generic modal: pass inner HTML + array of {label, className, onClick, closesModal}
  function showModal({ title, bodyHTML, buttons }) {
    const host = ensureModalHost();
    host.innerHTML = `
      <div class="qz-modal-backdrop" style="position:fixed;inset:0;background:rgba(20,16,24,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div class="card qz-modal-card" style="max-width:420px;width:100%;animation:none;">
          ${title ? `<h3 style="margin-top:0">${title}</h3>` : ""}
          <div class="small" style="margin:8px 0 18px;line-height:1.6">${bodyHTML}</div>
          <div class="row" style="gap:10px;justify-content:flex-end" id="qz-modal-btns"></div>
        </div>
      </div>`;
    const btnRow = host.querySelector("#qz-modal-btns");
    (buttons || []).forEach((b) => {
      const btn = document.createElement("button");
      btn.className = b.className || "btn btn-ghost";
      btn.type = "button";
      btn.textContent = b.label;
      btn.onclick = () => {
        if (b.onClick) b.onClick();
        if (b.closesModal !== false) closeModal();
      };
      btnRow.appendChild(btn);
    });
    host.querySelector(".qz-modal-backdrop").addEventListener("click", (e) => {
      if (e.target.classList.contains("qz-modal-backdrop")) closeModal();
    });
  }
  function closeModal() {
    const host = document.getElementById("qz-modal-host");
    if (host) host.innerHTML = "";
  }

  function showConfirmation(message, onConfirm, opts = {}) {
    showModal({
      title: opts.title || "Are you sure?",
      bodyHTML: message,
      buttons: [
        { label: opts.cancelLabel || "Cancel", className: "btn btn-ghost" },
        { label: opts.confirmLabel || "Confirm", className: "btn btn-accent", onClick: onConfirm },
      ],
    });
  }

  return { showSuccess, showError, showWarning, showInfo, showConfirmation, showModal, closeModal };
})();
