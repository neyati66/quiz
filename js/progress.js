// ============================================================
// progress.js — streaks, achievements, XP, derived stats.
// Phase 2: xp/streak/achievement UPDATES now happen on the server (server/services/gamification.js,
// same logic). registerActivity/evaluateAchievements below are kept for reference but no longer
// called; ACHIEVEMENTS (icons/labels) and the read-only stat helpers are still used by the UI.
// Mastery definition matches the reference app.js exactly:
// reps >= 2 && lastResult === "right".
// ============================================================

const ACHIEVEMENTS = [
  { id: "first_test", icon: "🎯", label: "First Test Completed", check: (d) => d.history.length >= 1 },
  { id: "streak_3", icon: "🔥", label: "3 Day Streak", check: (d) => (d.streak.best || 0) >= 3 },
  { id: "streak_7", icon: "🔥", label: "7 Day Streak", check: (d) => (d.streak.best || 0) >= 7 },
  { id: "mastered_10", icon: "🧠", label: "10 Questions Mastered", check: (d) => countMastered(d) >= 10 },
  { id: "perfect", icon: "💯", label: "100% Accuracy on a Test", check: (d) => d.history.some((a) => a.total > 0 && a.score === a.total) },
  { id: "top10", icon: "🏆", label: "Top 10 on the Leaderboard", check: (d) => !!d._top10 },
];

function countMastered(data) {
  return Object.values(data.sm2).filter((s) => s.reps >= 2 && s.lastResult === "right").length;
}

function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function registerActivity(data) {
  const today = todayKey();
  const last = data.streak.lastActivityDate;
  if (last !== today) {
    const yesterday = todayKey(Date.now() - 24 * 60 * 60 * 1000);
    data.streak.current = last === yesterday ? (data.streak.current || 0) + 1 : 1;
    data.streak.best = Math.max(data.streak.best || 0, data.streak.current);
    data.streak.lastActivityDate = today;
  }
  return data;
}

function evaluateAchievements(data) {
  const unlocked = new Set(data.achievements || []);
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach((a) => {
    if (!unlocked.has(a.id) && a.check(data)) {
      unlocked.add(a.id);
      newlyUnlocked.push(a);
    }
  });
  data.achievements = Array.from(unlocked);
  return newlyUnlocked;
}

function subjectAccuracy(data, subject) {
  const attempts = data.history.filter((a) => a.subject === subject);
  const totalQ = attempts.reduce((s, a) => s + a.total, 0);
  const totalC = attempts.reduce((s, a) => s + a.score, 0);
  return totalQ ? Math.round((totalC / totalQ) * 100) : 0;
}

function overallStats(data) {
  const attempts = data.history.length;
  const questionsAnswered = data.history.reduce((s, a) => s + a.total, 0);
  const correct = data.history.reduce((s, a) => s + a.score, 0);
  const accuracy = questionsAnswered ? Math.round((correct / questionsAnswered) * 100) : 0;
  const mastered = countMastered(data);
  const needsReview = Object.values(data.sm2).filter((s) => s.lastResult === "wrong").length;
  const learning = Object.values(data.sm2).filter((s) => s.lastResult === "right" && s.reps < 2).length;
  return { attempts, questionsAnswered, accuracy, mastered, learning, needsReview };
}

function dueQuestions(data) {
  // Phase 2: the bank is server-side; /api/me/data only returns SM-2 state for active questions.
  const now = Date.now();
  return Object.keys(data.sm2).filter((id) => data.sm2[id].nextReview <= now).map((id) => ({ id }));
}

// how many attempts a subject has had -> which Test N is "next"
function attemptsForSubject(data, subject) {
  return data.history.filter((a) => a.subject === subject).length;
}
