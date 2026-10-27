// ============================================================
// subjects.js — subjects grid (real data) + subject-search chatbot
// ============================================================

(function () {
  const user = Auth.requireAuth();
  if (!user) return;

  const grid = document.querySelector('[data-dynamic="subjects-list"]');
  let counts = null; // per-subject question counts, loaded from the API

  function renderSubjects(filter) {
    if (!grid) return;
    grid.innerHTML = "";
    const list = SUBJECTS.filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()));
    if (!list.length) {
      grid.innerHTML = `<div class="card empty"><div class="icon-chip">🔍</div><b>No matching subject</b><p class="small">Try ${SUBJECTS.map((s) => s.name).join(", ")}.</p></div>`;
      return;
    }
    list.forEach((s) => {
      const a = document.createElement("a");
      a.className = "card card-hover";
      a.href = `./test-selection.html?subject=${encodeURIComponent(s.key)}`;
      a.innerHTML = `<div class="icon-chip">${s.icon || "📚"}</div><h3 style="margin-top:12px">${s.name}</h3><p class="small">${s.desc}</p><div class="row between small muted" style="margin-top:14px"><span>3 tests</span><span>${counts ? (counts[s.key] ?? 0) : "…"} questions</span></div>`;
      grid.appendChild(a);
    });
  }
  renderSubjects();
  Api.publicStats().then((s) => { counts = s.perSubject; renderSubjects(searchInput ? searchInput.value : ""); })
    .catch((e) => Notify.showError(Api.messageOf(e)));

  // ---------- "chatbot" subject search (the page's search input + Filter button) ----------
  const searchInput = document.querySelector('input[type="search"]');
  const filterBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Filter");

  function runSearch() {
    const val = (searchInput?.value || "").trim();
    if (!val) { Notify.showWarning("Please enter a subject."); renderSubjects(); return; }
    const match = SUBJECTS.find((s) => s.name.toLowerCase() === val.toLowerCase() || s.name.toLowerCase().includes(val.toLowerCase()));
    if (match) {
      Notify.showSuccess(`Found "${match.name}" — showing its tests.`);
      window.location.href = `./test-selection.html?subject=${encodeURIComponent(match.key)}`;
    } else {
      Notify.showError(`No subject matching "${val}" yet. Try ${SUBJECTS.map((s) => s.name).join(", ")}.`);
      renderSubjects(val);
    }
  }
  if (filterBtn) filterBtn.addEventListener("click", runSearch);
  if (searchInput) {
    searchInput.addEventListener("input", () => renderSubjects(searchInput.value));
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
  }

  // ---------- subject chips filter ----------
  document.querySelectorAll(".tag").forEach((chip) => {
    chip.style.cursor = "pointer";
    chip.addEventListener("click", () => {
      const t = chip.textContent.trim();
      renderSubjects(t === "All" ? "" : t);
    });
  });
})();
