// Port of js/progress.js (streaks, mastery, achievements). Moved server-side because
// xp/streak/achievements are persisted state. Logic unchanged; the dates use the
// SERVER's local time zone (set TZ env var if you need a specific one).
function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function countMastered(sm2Map) {
  return Object.values(sm2Map).filter((s) => s.reps >= 2 && s.lastResult === 'right').length;
}

// data = { sm2, history:[{score,total}], streak, achievements }
const ACHIEVEMENTS = [
  { id: 'first_test', check: (d) => d.attemptCount >= 1 },
  { id: 'streak_3', check: (d) => (d.streak.best || 0) >= 3 },
  { id: 'streak_7', check: (d) => (d.streak.best || 0) >= 7 },
  { id: 'mastered_10', check: (d) => countMastered(d.sm2) >= 10 },
  { id: 'perfect', check: (d) => d.hasPerfect },
  { id: 'top10', check: (d) => !!d._top10 }, // never set in Phase 1 either
];

function registerActivity(streak, now = Date.now()) {
  const today = todayKey(now);
  const last = streak.lastActivityDate;
  if (last !== today) {
    const yesterday = todayKey(now - 24 * 60 * 60 * 1000);
    streak.current = last === yesterday ? (streak.current || 0) + 1 : 1;
    streak.best = Math.max(streak.best || 0, streak.current);
    streak.lastActivityDate = today;
  }
  return streak;
}

function evaluateAchievements(data) {
  const unlocked = new Set(data.achievements || []);
  const newly = [];
  ACHIEVEMENTS.forEach((a) => {
    if (!unlocked.has(a.id) && a.check(data)) { unlocked.add(a.id); newly.push(a.id); }
  });
  return { achievements: Array.from(unlocked), newlyUnlocked: newly };
}

module.exports = { todayKey, countMastered, registerActivity, evaluateAchievements };
