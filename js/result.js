// ============================================================
// result.js — mirrors the reference renderResult()/renderReview()
// remark bands and copy exactly; powers result.html.
// ============================================================

(async function () {
  const user = Auth.requireAuth();
  if (!user) return;
  const data = await Storage.loadUserData();
  const params = new URLSearchParams(window.location.search);
  const attemptId = params.get("attempt");
  const attempt = attemptId ? data.history.find((a) => a.id === attemptId) : data.history[data.history.length - 1];

  const main = document.querySelector("main.main");
  if (!attempt) {
    if (main) {
      const head = main.querySelector(".page-head p");
      if (head) head.textContent = "No attempts yet.";
      const empty = document.createElement("div");
      empty.className = "card empty";
      empty.style.marginTop = "18px";
      empty.innerHTML = `<div class="icon-chip">🧾</div><b>No tests completed yet</b><p class="small">Start your first test to see your results here.</p><a class="btn btn-sm" href="./subjects.html" style="margin-top:12px">Choose a subject</a>`;
      main.appendChild(empty);
    }
    return;
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }
  function remarkFor(pct) {
    if (pct >= 90) return { title: "Excellent!", sub: "You've nailed almost everything here." };
    if (pct >= 70) return { title: "Good — keep it up!", sub: "Solid grasp, a couple of gaps to close." };
    if (pct >= 50) return { title: "Keep practicing", sub: "You're halfway there — the misses will resurface next test." };
    return { title: "Needs work — don't stop", sub: "Tough round. Every wrong answer comes right back next time." };
  }

  const { score, total, timeSec } = attempt;
  const pct = Math.round((score / total) * 100);
  const r = remarkFor(pct);
  const avgSec = Math.round(timeSec / total);

  const summaryGrid = document.querySelector('[data-dynamic="result-summary"]');
  if (summaryGrid) {
    const cards = summaryGrid.querySelectorAll(".card h2");
    if (cards[0]) cards[0].textContent = `${pct}%`;
    if (cards[1]) cards[1].textContent = score;
    if (cards[2]) cards[2].textContent = total - score;
    if (cards[3]) cards[3].textContent = fmtTime(timeSec);
  }
  const headP = document.querySelector(".page-head p.small");
  if (headP) headP.textContent = `${attempt.subject} · Test ${attempt.testNumber} — ${r.title} ${r.sub}`;

  const breakdown = document.querySelector('[data-dynamic="accuracy-breakdown"] .stack');
  if (breakdown) {
    breakdown.innerHTML = "";
    SUBJECTS.forEach((s) => {
      const p = subjectAccuracy(data, s.key);
      const row = document.createElement("div");
      row.innerHTML = `<div class="row between small muted"><span>${s.name}</span><span>${p}%</span></div><div class="progress" style="margin-top:8px"><i style="width:${p}%"></i></div>`;
      breakdown.appendChild(row);
    });
  }

  const suggestions = document.querySelector('[data-dynamic="suggestions"]');
  if (suggestions) {
    const missed = total - score;
    suggestions.innerHTML = `<h3>What happens next</h3><p class="small" style="margin-top:10px">You answered <b>${score} of ${total}</b> questions correctly (${pct}%), averaging <b>${avgSec}s</b> per question. ` +
      (missed > 0
        ? `The ${missed} question${missed > 1 ? "s" : ""} you missed ${missed > 1 ? "have" : "has"} been scheduled to reappear in your next attempt on this subject.`
        : `Every question in this attempt is now on a longer review schedule.`) + `</p>` +
      `<a class="btn btn-sm btn-ghost" href="./test-selection.html?subject=${encodeURIComponent(attempt.subject)}" style="margin-top:14px">Back to Test Selection →</a>`;
  }

  const reviewSection = document.querySelector('[data-dynamic="question-review"] .stack');
  if (reviewSection) {
    reviewSection.innerHTML = "";
    attempt.questions.forEach((q, i) => {
      const a = attempt.answers[i];
      const yourAns = a.chosen === null ? "No answer (time out)" : q.options[a.chosen];
      const article = document.createElement("article");
      article.className = "card";
      article.innerHTML = `
        <div class="row between small muted"><span>Question ${i + 1} · ${q.cat}</span><span class="tag ${a.correct ? "" : "rose"}">${a.correct ? "Correct" : "Incorrect"}</span></div>
        <h3 style="margin-top:10px;font-size:16px" data-slot="qtext"></h3>
        <div class="stack" style="margin-top:12px">
          <div class="option" style="cursor:default${a.correct ? "" : ";border-color:var(--accent)"}" data-slot="your-ans">Your answer: </div>
          ${!a.correct ? `<div class="option" style="cursor:default;border-color:#2f9e6f" data-slot="correct-ans">Correct answer: </div>` : ""}
        </div>
        <p class="small" style="margin-top:10px"><b>Why:</b> <span data-slot="explain"></span></p>
      `;
      article.querySelector('[data-slot="qtext"]').appendChild(document.createTextNode(q.q));
      article.querySelector('[data-slot="your-ans"]').appendChild(document.createTextNode(yourAns));
      if (!a.correct) article.querySelector('[data-slot="correct-ans"]').appendChild(document.createTextNode(q.options[q.correct]));
      article.querySelector('[data-slot="explain"]').textContent = q.explain;
      reviewSection.appendChild(article);
    });
  }
})();
