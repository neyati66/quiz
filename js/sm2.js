// ============================================================
// sm2.js — EXACT port of the reference app.js SM-2 implementation.
// Nothing about the math or selection order has changed — only that
// selectQuestionsForSubject() filters to one subject's 12 questions
// instead of the whole 36-question bank, so each subject can run its
// own independent Test 1 / Test 2 / Test 3 sequence.
// ============================================================

const TEST_SIZE = 6;                 // unchanged: 6 questions per attempt
const Q_SECONDS = 30;                // unchanged: 30s per question
const DAY_MS = 24 * 60 * 60 * 1000;  // unchanged: real SM-2 day scheduling

// ---- SM-2 update (identical formula to the reference implementation) ----
function sm2Update(prev, quality) {
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

  const lastResult = quality < 3 ? "wrong" : "right";
  const nextReview = quality < 3 ? Date.now() : Date.now() + interval * DAY_MS;

  return { ef: Number(ef.toFixed(2)), reps, interval, nextReview, lastResult, lastReviewed: Date.now() };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- selectQuestions, scoped to one subject's question pool ----
// Same priority order as the reference app.js: due-for-review first,
// then fresh (never-seen) questions, then everything else — sliced to
// TEST_SIZE. This is what makes Test 2 bring back only what was wrong
// in Test 1, mixed with new material once the wrong ones run out.
function selectQuestionsForSubject(subject, sm2State) {
  const pool = questionsForSubject(subject);
  const now = Date.now();

  const due = [];
  const fresh = [];
  const rest = [];

  pool.forEach((q) => {
    const s = sm2State[q.id];
    if (!s) fresh.push(q);
    else if (s.nextReview <= now) due.push(q);
    else rest.push(q);
  });

  const picked = [...shuffle(due), ...shuffle(fresh), ...shuffle(rest)];
  return picked.slice(0, TEST_SIZE);
}
