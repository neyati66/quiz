// ============================================================
// Server-side SM-2 — a line-for-line port of the Phase 1 frontend
// (js/sm2.js sm2Update + selectQuestionsForSubject, and the quality rule
// in js/quiz.js submitTest). Formulas, constants and ordering are unchanged.
// The only difference: "now" and the random source are injectable so the
// code can be tested deterministically against the original file.
// ============================================================
const { TEST_SIZE, DAY_MS } = require('../config/constants');

// ---- identical to js/sm2.js sm2Update (plus optional `now`) ----
function sm2Update(prev, quality, now = Date.now()) {
  const s = prev || { ef: 2.5, reps: 0, interval: 0 };
  let ef = s.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;

  let reps = s.reps;
  let interval = s.interval;

  if (quality < 3) {
    reps = 0;
    interval = 1; // wrong answers come back next attempt
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps += 1;
  }

  const lastResult = quality < 3 ? 'wrong' : 'right';
  const nextReview = quality < 3 ? now : now + interval * DAY_MS;

  return { ef: Number(ef.toFixed(2)), reps, interval, nextReview, lastResult, lastReviewed: now };
}

// ---- identical to js/sm2.js shuffle (rng injectable) ----
function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- identical priority to js/sm2.js: due -> fresh -> rest, sliced to TEST_SIZE ----
// `pool` = this subject's active questions, `sm2State` = { [questionId]: state }
function selectQuestions(pool, sm2State, now = Date.now(), rng = Math.random) {
  const due = [];
  const fresh = [];
  const rest = [];
  pool.forEach((q) => {
    const s = sm2State[q.id];
    if (!s) fresh.push(q);
    else if (s.nextReview <= now) due.push(q);
    else rest.push(q);
  });
  const picked = [...shuffle(due, rng), ...shuffle(fresh, rng), ...shuffle(rest, rng)];
  return {
    questions: picked.slice(0, TEST_SIZE),
    counts: { due: due.length, fresh: fresh.length, rest: rest.length },
  };
}

// ---- identical to js/quiz.js submitTest quality rule ----
function qualityFor(correct, timeSec, chosen) {
  if (correct) return timeSec <= 10 ? 5 : (timeSec <= 20 ? 4 : 3);
  return chosen === null ? 0 : 1;
}

module.exports = { sm2Update, shuffle, selectQuestions, qualityFor };
