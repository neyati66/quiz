(function () {
  const stats = document.querySelector('[data-dynamic="platform-stats"]');
  if (stats) {
    const nums = stats.querySelectorAll(".stat b");
    if (nums[2]) nums[2].textContent = SUBJECTS.length;
    Api.publicStats().then((s) => { // counts only, from MongoDB
      if (nums[0]) nums[0].textContent = s.attempts;
      if (nums[1]) nums[1].textContent = s.users;
      if (nums[2]) nums[2].textContent = s.subjects;
      if (nums[3]) nums[3].textContent = s.questions;
    }).catch(() => { /* landing page stays usable if the API is down */ });
  }

  const featured = document.querySelector('[data-dynamic="featured-quizzes"]');
  if (featured) {
    featured.innerHTML = SUBJECTS.map((s) => `
      <article class="card card-hover">
        <div class="icon-chip">${s.icon || "📚"}</div>
        <b>${s.name}</b>
        <p class="small">${s.desc}</p>
        <a class="btn btn-sm btn-ghost" style="margin-top:14px" href="./test-selection.html?subject=${encodeURIComponent(s.key)}">Start test</a>
      </article>`).join("");
  }
})();
