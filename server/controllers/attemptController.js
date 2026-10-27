const mongoose = require('mongoose');
const Question = require('../models/Question');
const Progress = require('../models/Progress');
const QuizSession = require('../models/QuizSession');
const AttemptLog = require('../models/AttemptLog');
const User = require('../models/User');
const { AppError, asyncH } = require('../middleware/error');
const { fail } = require('../middleware/validate');
const { sm2Update, qualityFor } = require('../services/sm2');
const { registerActivity, evaluateAchievements } = require('../services/gamification');
const { Q_SECONDS, SUBJECTS, MAX_TEST_NUMBER, PREMIUM_FROM_TEST } = require('../config/constants');

const stateOf = (p) => (p ? { ef: p.ef, reps: p.reps, interval: p.interval, nextReview: p.nextReview, lastResult: p.lastResult, lastReviewed: p.lastReviewed } : null);

// Same shape Phase 1 stored in data.history, so result/dashboard/profile code keeps working.
function toClientAttempt(a) {
  return {
    id: String(a._id), date: new Date(a.createdAt).getTime(), subject: a.subject, testNumber: a.testNumber,
    score: a.score, total: a.total, timeSec: a.timeSec, xpGained: a.xpGained,
    questions: a.questions.map((q) => ({ id: q.id, cat: q.cat, q: q.q, options: q.options, correct: q.correct, explain: q.explain })),
    answers: a.answers.map((x) => ({ chosen: x.chosen, correct: x.correct, timeSec: x.timeSec, quality: x.quality })),
  };
}
exports.toClientAttempt = toClientAttempt;

function parseBody(b) {
  const errs = [];
  if (typeof b.sessionId !== 'string' || !/^[a-f0-9]{24}$/i.test(b.sessionId)) errs.push('sessionId is invalid');
  if (!SUBJECTS.includes(b.subject)) errs.push('subject is invalid');
  if (!Number.isInteger(b.testNumber) || b.testNumber < 1 || b.testNumber > MAX_TEST_NUMBER) errs.push(`testNumber must be an integer 1-${MAX_TEST_NUMBER}`);
  if (!Array.isArray(b.answers) || !b.answers.length || b.answers.length > 50) errs.push('answers must be a non-empty array');
  else {
    const seen = new Set();
    b.answers.forEach((a, i) => {
      if (!a || typeof a.questionId !== 'string' || !a.questionId) errs.push(`answers[${i}].questionId is required`);
      else if (seen.has(a.questionId)) errs.push(`answers[${i}] duplicates question ${a.questionId}`);
      else seen.add(a.questionId);
      if (!a || !(a.chosen === null || (Number.isInteger(a.chosen) && a.chosen >= 0 && a.chosen <= 3))) errs.push(`answers[${i}].chosen must be null or an integer 0-3`);
      if (!a || typeof a.timeSec !== 'number' || !Number.isFinite(a.timeSec) || a.timeSec < 0) errs.push(`answers[${i}].timeSec must be a non-negative number`);
    });
  }
  if (b.totalTimeSec !== undefined && (typeof b.totalTimeSec !== 'number' || !Number.isFinite(b.totalTimeSec) || b.totalTimeSec < 0)) errs.push('totalTimeSec must be a non-negative number');
  if (errs.length) fail(errs);
}

// Everything that must succeed or fail TOGETHER. `ds` = Mongo session (transaction) or null.
async function persistAttempt({ ds, userId, sessionId, body }) {
  const opt = ds ? { session: ds } : {};
  // 1) atomically claim the quiz session => a second submit finds submitted:true and is rejected (409)
  const qs = await QuizSession.findOneAndUpdate({ _id: sessionId, user: userId, submitted: false }, { $set: { submitted: true } }, { ...opt, new: false });
  if (!qs) {
    const exists = await QuizSession.findOne({ _id: sessionId, user: userId }).session(ds || null);
    if (!exists) throw new AppError(404, 'SESSION_NOT_FOUND', 'Quiz session not found or expired. Fetch /api/questions/due again.');
    throw new AppError(409, 'ALREADY_SUBMITTED', 'This attempt was already submitted.');
  }
  if (qs.subject !== body.subject || qs.testNumber !== body.testNumber) throw new AppError(400, 'SESSION_MISMATCH', 'subject/testNumber do not match the quiz session.');

  // 2) merge answers: answers locked earlier via /questions/answer win; the rest come from the body
  const sent = new Map(body.answers.map((a) => [a.questionId, a]));
  for (const id of sent.keys()) if (!qs.questionIds.includes(id)) throw new AppError(400, 'QUESTION_NOT_IN_SESSION', `Question ${id} was not issued in this attempt.`);
  const merged = qs.questionIds.map((id) => {
    const lock = qs.locked.find((l) => l.questionId === id);
    const s = sent.get(id);
    if (lock) {
      if (s && s.chosen !== lock.chosen) throw new AppError(409, 'ANSWER_MISMATCH', `Answer for ${id} differs from the one already locked.`);
      return { questionId: id, chosen: lock.chosen, timeSec: lock.timeSec };
    }
    if (!s) throw new AppError(400, 'INCOMPLETE_ATTEMPT', `Missing answer for question ${id}. All ${qs.questionIds.length} questions must be answered.`);
    return { questionId: id, chosen: s.chosen, timeSec: Math.min(Q_SECONDS, Math.round(s.timeSec)) };
  });

  // 3) load the authoritative questions + this student's current SM-2 state
  const qDocs = await Question.find({ questionId: { $in: qs.questionIds } }).session(ds || null);
  const qMap = new Map(qDocs.map((q) => [q.questionId, q]));
  if (qMap.size !== qs.questionIds.length) throw new AppError(409, 'QUESTION_UNAVAILABLE', 'A question in this attempt no longer exists.');
  const allProgress = await Progress.find({ user: userId }).session(ds || null).lean();
  const progMap = new Map(allProgress.map((p) => [p.questionId, p]));

  // 4) server-side grading + SM-2 (the client's score/correct flags are never used)
  const now = Date.now();
  const answers = [];
  const ops = [];
  let score = 0;
  merged.forEach((m) => {
    const q = qMap.get(m.questionId);
    const correct = m.chosen === q.correct;
    if (correct) score += 1;
    const quality = qualityFor(correct, m.timeSec, m.chosen);
    const before = stateOf(progMap.get(m.questionId));
    const after = sm2Update(before, quality, now);
    answers.push({ questionId: m.questionId, chosen: m.chosen, correct, timeSec: m.timeSec, quality, sm2Before: before, sm2After: after });
    ops.push({ updateOne: { filter: { user: userId, questionId: m.questionId }, update: { $set: { ...after, user: userId, questionId: m.questionId } }, upsert: true } });
    progMap.set(m.questionId, { ...after, questionId: m.questionId });
  });
  const total = merged.length;
  const sessionAgeSec = Math.round((now - new Date(qs.createdAt).getTime()) / 1000);
  const timeSec = body.totalTimeSec !== undefined ? Math.min(Math.round(body.totalTimeSec), 7200) : sessionAgeSec;
  const xpGained = score * 10;

  // 5) stats (xp / streak / achievements) — port of Phase 1 progress.js
  const user = await User.findById(userId).session(ds || null);
  const st = user.stats.streak;
  const streak = registerActivity({ current: st.current, best: st.best, lastActivityDate: st.lastActivityDate }, now);
  const prevCount = await AttemptLog.countDocuments({ user: userId }).session(ds || null);
  const prevPerfect = await AttemptLog.exists({ user: userId, $expr: { $and: [{ $gt: ['$total', 0] }, { $eq: ['$score', '$total'] }] } }).session(ds || null);
  const sm2Map = {};
  progMap.forEach((v, k) => { sm2Map[k] = v; });
  const ach = evaluateAchievements({
    sm2: sm2Map, streak, achievements: user.stats.achievements,
    attemptCount: prevCount + 1, hasPerfect: !!prevPerfect || (total > 0 && score === total),
  });

  const [attempt] = await AttemptLog.create([{
    user: userId, quizSession: qs._id, subject: qs.subject, testNumber: qs.testNumber, score, total, timeSec, xpGained,
    questionIds: qs.questionIds,
    questions: qs.questionIds.map((id) => { const q = qMap.get(id); return { id, cat: q.cat, q: q.q, options: q.options, correct: q.correct, explain: q.explain }; }),
    answers,
  }], opt);
  await Progress.bulkWrite(ops, opt);
  await User.updateOne({ _id: userId }, { $set: {
    'stats.xp': (user.stats.xp || 0) + xpGained,
    'stats.streak': streak,
    'stats.achievements': ach.achievements,
  } }, opt);

  return { attempt, answers, streak, xp: (user.stats.xp || 0) + xpGained, ach, ops: ops.length };
}

// Best-effort rollback used ONLY when MongoDB has no transaction support (standalone dev server).
async function compensate(userId, sessionId, body) {
  try {
    const log = await AttemptLog.findOne({ user: userId, quizSession: sessionId });
    if (log) {
      for (const a of log.answers) {
        if (a.sm2Before) await Progress.updateOne({ user: userId, questionId: a.questionId }, { $set: a.sm2Before });
        else await Progress.deleteOne({ user: userId, questionId: a.questionId });
      }
      await User.updateOne({ _id: userId }, { $inc: { 'stats.xp': -log.xpGained } });
      await AttemptLog.deleteOne({ _id: log._id });
    }
    await QuizSession.updateOne({ _id: sessionId, user: userId }, { $set: { submitted: false } });
  } catch (e) { console.error('Rollback failed:', e.message); }
}

// POST /api/attempts
exports.submit = asyncH(async (req, res) => {
  const body = req.body || {};
  parseBody(body);
  if (body.testNumber >= PREMIUM_FROM_TEST && !req.user.stats.subscribed) throw new AppError(403, 'PREMIUM_REQUIRED', 'Test 3 is available with Premium.');
  const userId = req.user._id;
  const sessionId = body.sessionId;

  let result;
  const ds = await mongoose.startSession();
  try {
    try {
      await ds.withTransaction(async () => { result = await persistAttempt({ ds, userId, sessionId, body }); });
    } catch (err) {
      // Standalone MongoDB (no replica set) cannot run transactions. Atlas can. Fall back safely.
      if (err && (err.code === 20 || /Transaction numbers are only allowed|replica set/i.test(err.message || ''))) {
        try { result = await persistAttempt({ ds: null, userId, sessionId, body }); }
        catch (e2) {
          // undo partial work (and un-claim the session) unless we failed before claiming it
          if (!(e2 instanceof AppError && ['ALREADY_SUBMITTED', 'SESSION_NOT_FOUND'].includes(e2.code))) await compensate(userId, sessionId, body);
          throw e2;
        }
      } else throw err;
    }
  } finally { ds.endSession(); }

  res.status(201).json({
    success: true,
    data: {
      attempt: toClientAttempt(result.attempt),
      sm2Updates: result.answers.map((a) => ({ questionId: a.questionId, quality: a.quality, ...a.sm2After })),
      stats: { xp: result.xp, streak: result.streak, achievements: result.ach.achievements, newlyUnlocked: result.ach.newlyUnlocked },
    },
  });
});

// GET /api/attempts — this student's attempts only
exports.list = asyncH(async (req, res) => {
  const docs = await AttemptLog.find({ user: req.user._id }).sort({ createdAt: 1 });
  res.json({ success: true, data: { attempts: docs.map(toClientAttempt) } });
});

// GET /api/attempts/:id — only if it belongs to the caller
exports.getOne = asyncH(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Attempt not found.');
  const a = await AttemptLog.findOne({ _id: req.params.id, user: req.user._id });
  if (!a) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Attempt not found.');
  res.json({ success: true, data: { attempt: toClientAttempt(a) } });
});
