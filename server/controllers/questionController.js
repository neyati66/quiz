const Question = require('../models/Question');
const Progress = require('../models/Progress');
const QuizSession = require('../models/QuizSession');
const { AppError, asyncH } = require('../middleware/error');
const { fail } = require('../middleware/validate');
const { selectQuestions } = require('../services/sm2');
const { TEST_SIZE, Q_SECONDS, SUBJECTS, MAX_TEST_NUMBER, PREMIUM_FROM_TEST } = require('../config/constants');

function parseTest(v) {
  const n = v === undefined ? 1 : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > MAX_TEST_NUMBER) fail([`test must be an integer 1-${MAX_TEST_NUMBER}`]);
  return n;
}

// GET /api/questions/due?subject=HTML&test=1
// Applies the Phase 1 selection (due -> fresh -> rest, 6 per attempt) using THIS student's saved SM-2 state.
// Correct answers/explanations are NOT included.
exports.getDue = asyncH(async (req, res) => {
  const subject = req.query.subject;
  if (!SUBJECTS.includes(subject)) fail([`subject must be one of: ${SUBJECTS.join(', ')}`]);
  const testNumber = parseTest(req.query.test);
  if (testNumber >= PREMIUM_FROM_TEST && !req.user.stats.subscribed) {
    throw new AppError(403, 'PREMIUM_REQUIRED', 'Test 3 is available with Premium.');
  }

  const pool = await Question.find({ cat: subject, active: true });
  const states = await Progress.find({ user: req.user._id, questionId: { $in: pool.map((q) => q.questionId) } }).lean();
  const sm2State = {};
  states.forEach((s) => { sm2State[s.questionId] = s; });

  const byId = new Map(pool.map((q) => [q.questionId, q]));
  const { questions, counts } = selectQuestions(pool.map((q) => ({ id: q.questionId })), sm2State);
  const picked = questions.map((x) => byId.get(x.id));

  let session = null;
  if (picked.length) {
    session = await QuizSession.create({ user: req.user._id, subject, testNumber, questionIds: picked.map((q) => q.questionId) });
  }
  res.json({
    success: true,
    data: {
      sessionId: session ? String(session._id) : null,
      subject, testNumber, testSize: TEST_SIZE, secondsPerQuestion: Q_SECONDS,
      selection: counts, // how many due / fresh / rest existed in this subject
      questions: picked.map((q) => q.toPublic()),
    },
  });
});

// POST /api/questions/answer   { sessionId, questionId, chosen, timeSec }
// Locks ONE answer (cannot be changed afterwards) and only then reveals the correct option + explanation.
// This preserves Phase 1's "lock and reveal immediately" UX without sending answers up front.
exports.answer = asyncH(async (req, res) => {
  const { sessionId, questionId, chosen, timeSec } = req.body || {};
  const errs = [];
  if (typeof sessionId !== 'string' || !/^[a-f0-9]{24}$/i.test(sessionId)) errs.push('sessionId is invalid');
  if (typeof questionId !== 'string' || !questionId) errs.push('questionId is required');
  if (!(chosen === null || (Number.isInteger(chosen) && chosen >= 0 && chosen <= 3))) errs.push('chosen must be null or an integer 0-3');
  if (typeof timeSec !== 'number' || !Number.isFinite(timeSec) || timeSec < 0) errs.push('timeSec must be a non-negative number');
  if (errs.length) fail(errs);
  const t = Math.min(Q_SECONDS, Math.round(timeSec)); // Phase 1: Math.min(Q_SECONDS, round(...))

  const updated = await QuizSession.findOneAndUpdate(
    { _id: sessionId, user: req.user._id, submitted: false, questionIds: questionId, 'locked.questionId': { $ne: questionId } },
    { $push: { locked: { questionId, chosen, timeSec: t, at: new Date() } } },
    { new: true }
  );
  let lockedChosen = chosen;
  if (!updated) {
    const s = await QuizSession.findOne({ _id: sessionId, user: req.user._id });
    if (!s) throw new AppError(404, 'SESSION_NOT_FOUND', 'Quiz session not found or expired.');
    if (s.submitted) throw new AppError(409, 'ALREADY_SUBMITTED', 'This attempt was already submitted.');
    if (!s.questionIds.includes(questionId)) throw new AppError(400, 'QUESTION_NOT_IN_SESSION', 'That question is not part of this attempt.');
    lockedChosen = s.locked.find((l) => l.questionId === questionId).chosen; // already locked: idempotent, original answer stands
  }
  const q = await Question.findOne({ questionId });
  if (!q) throw new AppError(409, 'QUESTION_UNAVAILABLE', 'Question no longer exists.');
  res.json({ success: true, data: { questionId, chosen: lockedChosen, correct: q.correct, isCorrect: lockedChosen === q.correct, explain: q.explain } });
});

// GET /api/public/stats (no auth) — counts only, never question content
exports.publicStats = asyncH(async (req, res) => {
  const User = require('../models/User');
  const AttemptLog = require('../models/AttemptLog');
  const [users, attempts, perSubjectRaw] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    AttemptLog.countDocuments(),
    Question.aggregate([{ $match: { active: true } }, { $group: { _id: '$cat', n: { $sum: 1 } } }]),
  ]);
  const perSubject = {};
  SUBJECTS.forEach((s) => { perSubject[s] = 0; });
  perSubjectRaw.forEach((r) => { perSubject[r._id] = r.n; });
  const questions = Object.values(perSubject).reduce((a, b) => a + b, 0);
  res.json({ success: true, data: { users, attempts, subjects: SUBJECTS.length, questions, perSubject } });
});
