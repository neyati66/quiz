const Progress = require('../models/Progress');
const Question = require('../models/Question');
const AttemptLog = require('../models/AttemptLog');
const User = require('../models/User');
const { asyncH } = require('../middleware/error');
const { toClientAttempt } = require('./attemptController');

// GET /api/me/data — everything Phase 1 kept in localStorage `userdata`, now from MongoDB.
exports.data = asyncH(async (req, res) => {
  const [progress, attempts, activeIds] = await Promise.all([
    Progress.find({ user: req.user._id }).lean(),
    AttemptLog.find({ user: req.user._id }).sort({ createdAt: 1 }),
    Question.find({ active: true }).distinct('questionId'),
  ]);
  const active = new Set(activeIds);
  const sm2 = {};
  progress.filter((p) => active.has(p.questionId)).forEach((p) => {
    sm2[p.questionId] = { ef: p.ef, reps: p.reps, interval: p.interval, nextReview: p.nextReview, lastResult: p.lastResult, lastReviewed: p.lastReviewed };
  });
  const s = req.user.stats;
  res.json({
    success: true,
    data: {
      user: req.user.toSafeJSON(),
      sm2, history: attempts.map(toClientAttempt),
      streak: { current: s.streak.current, best: s.streak.best, lastActivityDate: s.streak.lastActivityDate },
      achievements: s.achievements, xp: s.xp, subscribed: s.subscribed,
    },
  });
});

// GET /api/leaderboard — public fields only (no emails). `isYou` marks the caller's own row.
exports.leaderboard = asyncH(async (req, res) => {
  const [agg, mastered] = await Promise.all([
    AttemptLog.aggregate([{ $group: { _id: '$user', attempts: { $sum: 1 }, score: { $sum: '$score' }, total: { $sum: '$total' } } }]),
    Progress.aggregate([{ $match: { reps: { $gte: 2 }, ef: { $gte: 2.5 } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]), // Phase 1 leaderboard "mastered" rule
  ]);
  const mMap = new Map(mastered.map((m) => [String(m._id), m.n]));
  const users = await User.find({ _id: { $in: agg.map((a) => a._id) }, role: 'student' });
  const uMap = new Map(users.map((u) => [String(u._id), u]));
  const people = agg.filter((a) => uMap.has(String(a._id))).map((a) => {
    const u = uMap.get(String(a._id));
    return {
      name: u.name, xp: u.stats.xp || 0, attempts: a.attempts,
      accuracy: a.total ? Math.round((a.score / a.total) * 100) : 0,
      streak: u.stats.streak.current || 0, mastered: mMap.get(String(a._id)) || 0,
      isYou: String(u._id) === String(req.user._id),
    };
  }).sort((a, b) => b.xp - a.xp || b.accuracy - a.accuracy).slice(0, 100);
  res.json({ success: true, data: { people } });
});
