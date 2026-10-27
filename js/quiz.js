// ============================================================
// quiz.js — quiz engine, wired to Quizzy's UI. Same flow as Phase 1:
// 6 questions, 30s/question, immediate lock-and-reveal on answer,
// total timer counts UP only.
// Phase 2: questions come from GET /api/questions/due (WITHOUT the correct
// answer); each answer is locked + revealed via POST /api/questions/answer;
// the finished attempt is POSTed to /api/attempts where the SERVER grades it
// and runs the (unchanged) SM-2 update. The browser no longer computes or saves
// any SM-2 state.
// ============================================================

(async function () {
  const params = new URLSearchParams(window.location.search);
  const subject = params.get("subject");
  const testNumber = Number(params.get("test") || 1);

  const user = Auth.requireAuth();
  if (!user) return;

  if (!subject || !SUBJECTS.some((s) => s.key === subject)) { window.location.href = "./subjects.html"; return; }
  const backToTests = () => { window.location.href = `./test-selection.html?subject=${encodeURIComponent(subject)}`; };
  const qTextElEarly = document.querySelector('[data-dynamic="question-text"]');
  if (qTextElEarly) qTextElEarly.textContent = "Loading questions…"; // loading state

  // The server picks the questions (due -> fresh -> rest) from THIS student's saved SM-2 state.
  let due;
  try {
    due = await Api.getDue(subject, testNumber);
  } catch (e) {
    if (e.code === "PREMIUM_REQUIRED") { showPremiumModal(backToTests); return; }
    Notify.showError(Api.messageOf(e));
    setTimeout(backToTests, 1800);
    return;
  }
  const questions = due.questions;           // [{id, cat, q, options}] — no `correct` here
  const sessionId = due.sessionId;
  if (!questions.length || !sessionId) { backToTests(); return; }

  const N = questions.length;
  const answers = questions.map(() => null); // null until locked: {chosen, correct, correctIndex, timeSec}
  let locking = false;                        // blocks double-clicks while the server confirms an answer
  let index = 0;
  let viewIndex = 0;
  const startedAt = Date.now();
  let qStart = Date.now();
  let totalInterval = null;
  let qInterval = null;

  function qText(root, prefix) {
    return root ? Array.from(root.querySelectorAll("button, a")).find((el) => el.textContent.trim().startsWith(prefix)) : null;
  }

  const totalTimerEl = document.querySelector('[data-dynamic="total-timer"]');
  const qTimerEl = document.querySelector('[data-dynamic="q-timer"]');
  const idxEl = document.querySelector('[data-dynamic="question-index"]');
  const catEl = document.querySelector('[data-dynamic="difficulty"]');
  const progressFill = document.querySelector(".progress > i");
  const qTextEl = document.querySelector('[data-dynamic="question-text"]');
  const optionsEl = document.querySelector('[data-dynamic="options"]');
  const paletteEl = document.querySelector('[data-dynamic="question-palette"]');
  const summaryEl = document.querySelector('[data-dynamic="attempt-summary"]');
  const cardEl = qTextEl ? qTextEl.closest(".card") : null;
  const bottomRow = cardEl ? cardEl.querySelector(".row.between:last-of-type") : null;
  const prevBtn = qText(bottomRow, "← Previous");
  const markBtn = qText(bottomRow, "Mark for review");
  const nextBtn = qText(bottomRow, "Next");
  const exitLink = qText(document.querySelector("header.nav"), "Exit");
  const submitBtn = qText(summaryEl, "Submit test");

  if (markBtn) markBtn.style.display = "none"; // not part of the reference flow
  if (submitBtn) submitBtn.style.display = "none"; // submission happens via Next on the last question, as in the reference

  function fmtTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ---------- total timer: counts UP only, no overall limit (matches reference) ----------
  function startTotalTimer() {
    totalInterval = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      if (totalTimerEl) totalTimerEl.textContent = `⏱ Total ${fmtTime(s)}`;
    }, 250);
  }

  // ---------- per-question countdown: 30s, locks answer at 0 ----------
  function startQuestionTimer() {
    clearInterval(qInterval);
    qStart = Date.now();
    let remaining = Q_SECONDS;
    if (qTimerEl) { qTimerEl.textContent = `● ${remaining}s`; qTimerEl.classList.remove("rose"); qTimerEl.classList.add("lemon"); }
    qInterval = setInterval(() => {
      remaining -= 1;
      if (qTimerEl) qTimerEl.textContent = `● ${Math.max(remaining, 0)}s`;
      if (remaining <= 10 && qTimerEl) { qTimerEl.classList.remove("lemon"); qTimerEl.classList.add("rose"); }
      if (remaining <= 0) {
        clearInterval(qInterval);
        lockAnswer(null);
      }
    }, 1000);
  }

  // ---------- render ----------
  function render() {
    viewIndex = index;
    const q = questions[viewIndex];
    if (idxEl) idxEl.innerHTML = `Question <b>${viewIndex + 1}</b> of <b>${N}</b>`;
    if (catEl) catEl.textContent = q.cat;
    if (progressFill) progressFill.style.width = `${Math.round((viewIndex / N) * 100)}%`;
    if (qTextEl) qTextEl.textContent = q.q;

    renderOptions(viewIndex, true);
    renderPalette();
    if (prevBtn) prevBtn.disabled = viewIndex === 0;
    if (nextBtn) {
      nextBtn.textContent = viewIndex === N - 1 ? "Submit Test →" : "Next Question →";
      nextBtn.disabled = answers[viewIndex] === null;
    }
    startQuestionTimer();
  }

  // view an already-answered question (read-only, no timer)
  function viewAnswered(i) {
    clearInterval(qInterval);
    viewIndex = i;
    const q = questions[i];
    if (idxEl) idxEl.innerHTML = `Question <b>${i + 1}</b> of <b>${N}</b>`;
    if (catEl) catEl.textContent = q.cat;
    if (progressFill) progressFill.style.width = `${Math.round(((index) / N) * 100)}%`;
    if (qTextEl) qTextEl.textContent = q.q;
    renderOptions(i, false);
    renderPalette();
    if (prevBtn) prevBtn.disabled = i === 0;
    if (nextBtn) { nextBtn.textContent = "Next Question →"; nextBtn.disabled = false; }
  }

  function renderOptions(i, live) {
    const q = questions[i];
    const a = answers[i];
    if (!optionsEl) return;
    optionsEl.innerHTML = "";
    const keys = ["A", "B", "C", "D"];
    q.options.forEach((opt, k) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      const keySpan = document.createElement("span");
      keySpan.className = "key";
      keySpan.textContent = keys[k];
      btn.appendChild(keySpan);
      btn.appendChild(document.createTextNode(" " + opt));
      if (a) {
        btn.disabled = true;
        if (k === a.correctIndex) btn.classList.add("correct");
        if (k === a.chosen && a.chosen !== a.correctIndex) btn.classList.add("incorrect");
        if (k === a.chosen) btn.classList.add("selected");
      } else if (live) {
        btn.addEventListener("click", () => lockAnswer(k));
      } else {
        btn.disabled = true;
      }
      optionsEl.appendChild(btn);
    });
  }

  function renderPalette() {
    if (!paletteEl) return;
    paletteEl.innerHTML = "";
    questions.forEach((q, i) => {
      const dot = document.createElement("span");
      dot.textContent = i + 1;
      dot.style.cursor = i <= index ? "pointer" : "default";
      let bg = "";
      if (i === viewIndex) bg = "outline:2px solid var(--primary);outline-offset:2px;";
      if (answers[i]) bg += answers[i].correct ? "background:var(--mint);color:var(--correct-text);" : "background:var(--accent-soft);color:var(--incorrect-text);";
      else if (i === index) bg += "background:var(--sky);";
      dot.style.cssText += bg;
      if (i <= index) dot.addEventListener("click", () => { answers[i] ? viewAnswered(i) : render(); });
      paletteEl.appendChild(dot);
    });
  }

  function renderSummary() {
    if (!summaryEl) return;
    const answered = answers.filter((a) => a !== null).length;
    const correct = answers.filter((a) => a && a.correct).length;
    const rows = summaryEl.querySelectorAll(".row.between");
    if (rows[0]) rows[0].querySelector("b").textContent = answered;
    if (rows[1]) rows[1].querySelector("b").textContent = correct;
    if (rows[2]) rows[2].querySelector("b").textContent = N - answered;
  }

  // ---------- lock + reveal (identical grading to the reference) ----------
  async function lockAnswer(chosenIndex) {
    if (locking || answers[index] !== null) return;
    locking = true;
    clearInterval(qInterval);
    const q = questions[index];
    const timeSec = Math.min(Q_SECONDS, Math.round((Date.now() - qStart) / 1000)); // same as Phase 1
    if (optionsEl) optionsEl.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    let reveal = null;
    for (let attempt = 0; attempt < 3 && !reveal; attempt++) {
      try {
        reveal = await Api.answer({ sessionId, questionId: q.id, chosen: chosenIndex, timeSec });
      } catch (e) {
        if (e.code !== "NETWORK") { Notify.showError(Api.messageOf(e)); break; }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    locking = false;
    if (!reveal) { // couldn't reach the server: let the student try again
      Notify.showError("Couldn't save your answer. Please check your connection and pick an answer again.");
      renderOptions(index, true);
      return;
    }
    answers[index] = { chosen: reveal.chosen, correct: reveal.isCorrect, correctIndex: reveal.correct, timeSec };
    renderOptions(index, false);
    renderPalette();
    renderSummary();
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = index === N - 1 ? "Submit Test →" : "Next Question →";
    }
  }

  if (nextBtn) nextBtn.addEventListener("click", () => {
    if (viewIndex !== index) { render(); return; } // was viewing a past question — return to the live one
    if (answers[index] === null) return;
    if (index < N - 1) { index += 1; render(); }
    else submitTest();
  });
  if (prevBtn) prevBtn.addEventListener("click", () => { if (viewIndex > 0) viewAnswered(viewIndex - 1); });
  if (exitLink) exitLink.addEventListener("click", (e) => {
    e.preventDefault();
    Notify.showConfirmation("Your progress in this attempt will be lost. Are you sure you want to leave?", () => {
      window.location.href = exitLink.getAttribute("href");
    }, { title: "Leave test?", confirmLabel: "Leave" });
  });

  // ---------- submit: the SERVER grades the attempt and persists the SM-2 update ----------
  let submitting = false;
  async function submitTest() {
    if (submitting) return;
    submitting = true;
    clearInterval(qInterval);
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = "Submitting…"; }

    const totalSec = Math.round((Date.now() - startedAt) / 1000);
    try {
      const res = await Api.submitAttempt({
        sessionId, subject, testNumber, totalTimeSec: totalSec,
        answers: questions.map((q, i) => ({ questionId: q.id, chosen: answers[i].chosen, timeSec: answers[i].timeSec })),
      });
      clearInterval(totalInterval);
      Storage.invalidate();
      (res.stats.newlyUnlocked || []).forEach((id) => {
        const a2 = ACHIEVEMENTS.find((x) => x.id === id);
        if (a2) Notify.showSuccess(`Achievement unlocked: ${a2.icon} ${a2.label}`);
      });
      Notify.showSuccess("✓ Test submitted successfully.");
      setTimeout(() => { window.location.href = `./result.html?attempt=${res.attempt.id}`; }, 500);
    } catch (e) {
      submitting = false;
      Notify.showError(Api.messageOf(e));
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = "Submit Test →"; } // allow a retry
    }
  }

  startTotalTimer();
  render();
})();
