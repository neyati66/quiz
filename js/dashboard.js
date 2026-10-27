// ============================================================
// dashboard.js — powers dashboard.html with real user data
// ============================================================

(async function () {
  const user = Auth.requireAuth();
  if (!user) return;
  const data = await Storage.loadUserData();
  const stats = overallStats(data);
  const due = dueQuestions(data);

  document.querySelector(".page-head p.small").textContent = `Welcome back, ${user.name}.`;

  // ---------- top stat cards ----------
  const statCards = document.querySelectorAll('[data-dynamic="user-stats"] .card h2');
  if (statCards.length) {
    statCards[0].textContent = stats.attempts;
    statCards[1].textContent = stats.questionsAnswered;
    statCards[2].textContent = stats.attempts ? `${stats.accuracy}%` : "—";
    statCards[3].textContent = new Set(data.history.map((a) => a.subject)).size;
  }

  // ---------- recent attempts ----------
  const recentBox = document.querySelector('[data-dynamic="recent-attempts"]');
  if (recentBox) {
    const recent = [...data.history].reverse().slice(0, 5);
    if (recent.length) {
      recentBox.querySelector(".empty")?.remove();
      const list = document.createElement("div");
      list.className = "stack";
      list.style.marginTop = "14px";
      recent.forEach((a) => {
        const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
        const row = document.createElement("a");
        row.className = "option";
        row.style.cssText = "display:flex;justify-content:space-between;text-decoration:none;";
        row.href = `./result.html?attempt=${a.id}`;
        row.innerHTML = `<span>${a.subject} · Test ${a.testNumber}</span><b>${pct}%</b>`;
        list.appendChild(row);
      });
      recentBox.appendChild(list);
    }
  }

  // ---------- review due (replaces "continue learning" empty state) ----------
  const continueBox = document.querySelector('[data-dynamic="continue-learning"]');
  if (continueBox) {
    continueBox.innerHTML = `<h3>🧠 Review Due</h3>`;
    if (due.length) {
      continueBox.innerHTML += `
        <div class="row between" style="margin-top:14px;align-items:center">
          <p class="small" style="margin:0">${due.length} question${due.length === 1 ? "" : "s"} are ready for review — they'll be prioritized the next time you take a test in that subject.</p>
        </div>
        <a class="btn btn-accent btn-block" href="./subjects.html" style="margin-top:12px">Go to Subjects</a>`;
    } else {
      continueBox.innerHTML += `<div class="empty" style="margin-top:14px"><div class="icon-chip" style="background:var(--mint)">✅</div><b>All caught up</b><p class="small">No questions are due for review right now.</p></div>`;
    }
  }

  // ---------- progress by subject ----------
  const progressBox = document.querySelector('[data-dynamic="progress-by-subject"] .stack');
  if (progressBox) {
    progressBox.innerHTML = "";
    SUBJECTS.forEach((s) => {
      const pct = subjectAccuracy(data, s.key);
      const row = document.createElement("div");
      row.innerHTML = `<div class="row between small muted"><span>${s.name}</span><span>${pct}%</span></div><div class="progress" style="margin-top:8px"><i style="width:${pct}%"></i></div>`;
      progressBox.appendChild(row);
    });
  }

  // ---------- mastery + recommendations (appended, existing layout preserved) ----------
  const main = document.querySelector("main.main");
  if (main) {
    const extra = document.createElement("section");
    extra.className = "grid g2";
    extra.style.marginTop = "22px";

    const masteryCard = document.createElement("section");
    masteryCard.className = "card";
    masteryCard.innerHTML = `<h3>Question mastery</h3>
      <div class="stack small" style="margin-top:14px">
        <div class="row between"><span>🟢 Mastered</span><b>${stats.mastered}</b></div>
        <div class="row between"><span>🟡 Learning</span><b>${stats.learning}</b></div>
        <div class="row between"><span>🔴 Needs review</span><b>${stats.needsReview}</b></div>
      </div>`;

    const recCard = document.createElement("section");
    recCard.className = "card";
    const recs = [];
    if (due.length) recs.push(`🧠 Review ${due.length} due question${due.length === 1 ? "" : "s"}`);
    SUBJECTS.forEach((s) => {
      const attempted = new Set(data.history.filter((a) => a.subject === s.key).map((a) => a.testNumber));
      if (!attempted.has(2) && attempted.has(1)) recs.push(`📚 Continue ${s.name} — Test 2`);
      if (!attempted.has(1)) recs.push(`⚡ Start ${s.name} — Test 1`);
    });
    if (!recs.length) recs.push("🏆 Great job — try a Test 3 (Premium) for a bigger challenge");
    recCard.innerHTML = `<h3>Recommended for you</h3><div class="stack small" style="margin-top:14px">${recs.slice(0, 4).map((r) => `<div class="option" style="cursor:default">${r}</div>`).join("")}</div>`;

    extra.appendChild(masteryCard);
    extra.appendChild(recCard);
    main.appendChild(extra);

    // Achievements strip
    const achCard = document.createElement("section");
    achCard.className = "card";
    achCard.style.marginTop = "22px";
    const unlocked = new Set(data.achievements || []);
    achCard.innerHTML = `<h3>🏆 Achievements</h3><div class="row" style="flex-wrap:wrap;gap:10px;margin-top:14px">${ACHIEVEMENTS.map((a) =>
      `<span class="tag${unlocked.has(a.id) ? "" : " muted"}" style="${unlocked.has(a.id) ? "" : "opacity:.45"}">${a.icon} ${a.label}</span>`
    ).join("")}</div>`;
    main.appendChild(achCard);
  }
})();
