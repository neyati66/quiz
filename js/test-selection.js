// ============================================================
// test-selection.js — Test 1 / Test 2 / Test 3 always visible,
// chosen manually. No auto-advance to the next test.
// ============================================================

(async function () {
  const user = Auth.requireAuth();
  if (!user) return;
  const data = await Storage.loadUserData();

  const params = new URLSearchParams(window.location.search);
  let subject = params.get("subject") || SUBJECTS[0].key;

  const subjectSelect = document.getElementById("subject");
  const availableBox = document.querySelector('[data-dynamic="available-tests"]');
  const countInput = document.getElementById("count");
  const durationInput = document.getElementById("duration");
  const oldStartBtn = Array.from(document.querySelectorAll("a.btn")).find((a) => a.textContent.trim() === "Start test");
  if (oldStartBtn) oldStartBtn.style.display = "none"; // replaced by the three explicit Test cards below

  if (subjectSelect) {
    subjectSelect.innerHTML = SUBJECTS.map((s) => `<option value="${s.key}" ${s.key === subject ? "selected" : ""}>${s.name}</option>`).join("");
    subjectSelect.addEventListener("change", () => { subject = subjectSelect.value; renderTests(); });
  }

  function renderTests() {
    const headP = document.querySelector(".page-head p.small");
    if (headP) headP.textContent = `${subject} — choose a test to start.`;
    if (countInput) countInput.value = TEST_SIZE;
    if (durationInput) durationInput.value = Math.round((TEST_SIZE * Q_SECONDS) / 60);

    const doneCount = attemptsForSubject(data, subject); // how many tests completed for this subject
    if (!availableBox) return;
    availableBox.innerHTML = `<h3>Available tests — ${subject}</h3><div class="stack" style="margin-top:14px" id="test-list"></div>`;
    const list = availableBox.querySelector("#test-list");

    [1, 2, 3].forEach((n) => {
      const completed = doneCount >= n;
      const isNext = doneCount + 1 === n;
      const premiumLocked = n >= 3 && !data.subscribed;
      const sequenceLocked = !completed && !isNext; // must finish earlier tests first

      const row = document.createElement("div");
      row.className = "option" + (premiumLocked || sequenceLocked ? " locked-overlay" : "");
      row.style.cssText = "cursor:pointer;justify-content:space-between;display:flex;align-items:center;";
      let statusText = premiumLocked ? "Premium" : sequenceLocked ? "Complete the previous test first" : completed ? "✓ Completed" : "Available";
      row.innerHTML = `<span>Test ${n}${n >= 3 ? " · Premium" : " · Free"}</span><span class="small muted">${TEST_SIZE} questions · ${statusText}</span>`;
      row.addEventListener("click", () => {
        if (premiumLocked) { showPremiumModal(); return; }
        if (sequenceLocked) { Notify.showWarning(`Complete Test ${n - 1} first.`); return; }
        window.location.href = `./quiz.html?subject=${encodeURIComponent(subject)}&test=${n}`;
      });
      list.appendChild(row);
    });
  }

  renderTests();
})();
