// ============================================================
// leaderboard.js — powers leaderboard.html with real user data.
// Phase 2: ranks every student in MongoDB via GET /api/leaderboard (public fields only — no emails).
// ============================================================

(async function () {
  const user = Auth.requireAuth();
  if (!user) return;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let people = [];
  try {
    people = (await Api.leaderboard()).people.filter((p) => p.attempts > 0); // already sorted by the server
  } catch (e) { Notify.showError(Api.messageOf(e)); }

  const podium = document.querySelector('[data-dynamic="podium"]');
  const tableBox = document.querySelector('[data-dynamic="leaderboard-table"]');
  const searchInput = document.querySelector('input[type="search"]');

  function render(list) {
    if (podium) {
      const top3 = list.slice(0, 3);
      const slots = [top3[1], top3[0], top3[2]]; // silver, gold, bronze layout as in markup
      const medals = ["🥈", "🥇", "🥉"];
      podium.innerHTML = slots.map((p, i) => p
        ? `<div class="card"><div class="icon-chip">${medals[i]}</div><b>${esc(p.name)}</b><p class="small">${p.xp} XP · ${p.accuracy}% accuracy</p></div>`
        : `<div class="card empty"><div class="icon-chip">${medals[i]}</div><b>Rank ${i === 1 ? 1 : i === 0 ? 2 : 3}</b><p class="small">Awaiting results</p></div>`
      ).join("");
    }
    if (tableBox) {
      if (!list.length) {
        tableBox.innerHTML = `<div class="empty"><div class="icon-chip">🏅</div><b>No rankings yet</b><p class="small">Complete a test to populate this board.</p></div>`;
        return;
      }
      const rows = list.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><div class="row"><span class="avatar">${esc(p.name[0]?.toUpperCase() || "?")}</span><span>${esc(p.name)}${p.isYou ? " (you)" : ""}</span></div></td>
          <td>${p.attempts}</td>
          <td>${p.accuracy}%</td>
          <td>${p.xp}</td>
        </tr>`).join("");
      tableBox.innerHTML = `<table class="table"><thead><tr><th>#</th><th>Learner</th><th>Tests</th><th>Accuracy</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  }
  render(people);

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const v = searchInput.value.trim().toLowerCase();
      render(v ? people.filter((p) => p.name.toLowerCase().includes(v)) : people);
    });
  }
})();
