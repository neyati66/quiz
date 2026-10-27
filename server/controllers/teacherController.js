const crypto = require('crypto');
const Question = require('../models/Question');
const AttemptLog = require('../models/AttemptLog');
const { AppError, asyncH } = require('../middleware/error');
const { validateQuestion, fail } = require('../middleware/validate');
const { SUBJECTS } = require('../config/constants');

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const find = async (id) => {
  const q = ID_RE.test(id) ? await Question.findOne({ questionId: id }) : null;
  if (!q) throw new AppError(404, 'QUESTION_NOT_FOUND', `Question "${id}" not found.`);
  return q;
};

// POST /api/teacher/questions
exports.create = asyncH(async (req, res) => {
  const body = req.body || {};
  const fields = validateQuestion(body);
  let questionId = body.id;
  if (questionId !== undefined && (typeof questionId !== 'string' || !ID_RE.test(questionId))) fail(['id must match [A-Za-z0-9_-] and be at most 32 chars']);
  if (!questionId) questionId = 'q_' + crypto.randomBytes(5).toString('hex');
  if (await Question.exists({ questionId })) throw new AppError(409, 'DUPLICATE_ID', `A question with id "${questionId}" already exists.`);
  // duplicate-text guard within the same subject
  if (await Question.exists({ cat: fields.cat, q: fields.q, active: true })) throw new AppError(409, 'DUPLICATE_QUESTION', 'An active question with the same text already exists in this subject.');
  const q = await Question.create({ ...fields, questionId, createdBy: req.user._id });
  res.status(201).json({ success: true, data: { question: q.toFull() } });
});

// GET /api/teacher/questions?subject=&includeArchived=true&page=1&limit=50
exports.list = asyncH(async (req, res) => {
  const filter = {};
  if (req.query.subject) { if (!SUBJECTS.includes(req.query.subject)) fail(['subject is invalid']); filter.cat = req.query.subject; }
  if (req.query.includeArchived !== 'true') filter.active = true;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const [items, total] = await Promise.all([
    Question.find(filter).sort({ cat: 1, createdAt: 1, questionId: 1 }).skip((page - 1) * limit).limit(limit),
    Question.countDocuments(filter),
  ]);
  res.json({ success: true, data: { questions: items.map((q) => q.toFull()), page, limit, total } });
});

// GET /api/teacher/questions/:id
exports.getOne = asyncH(async (req, res) => {
  res.json({ success: true, data: { question: (await find(req.params.id)).toFull() } });
});

// PUT /api/teacher/questions/:id  (partial updates allowed; the id itself is immutable)
exports.update = asyncH(async (req, res) => {
  const q = await find(req.params.id);
  const body = req.body || {};
  if (body.id !== undefined && body.id !== q.questionId) fail(['question id cannot be changed']);
  const fields = validateQuestion(body, { partial: true });
  const merged = { cat: fields.cat ?? q.cat, q: fields.q ?? q.q };
  if ((fields.cat || fields.q) && await Question.exists({ cat: merged.cat, q: merged.q, active: true, questionId: { $ne: q.questionId } })) {
    throw new AppError(409, 'DUPLICATE_QUESTION', 'Another active question with the same text exists in this subject.');
  }
  // options + correct must stay consistent
  Object.assign(q, fields);
  if (fields.active === true) q.archivedAt = null;
  if (fields.active === false) q.archivedAt = new Date();
  await q.save();
  // NOTE: students' SM-2 progress and AttemptLog snapshots are untouched.
  res.json({ success: true, data: { question: q.toFull() } });
});

// DELETE /api/teacher/questions/:id
//  - never attempted by anyone -> permanently deleted
//  - has history -> archived (active:false); history, snapshots and SM-2 rows are kept
exports.remove = asyncH(async (req, res) => {
  const q = await find(req.params.id);
  const used = await AttemptLog.exists({ questionIds: q.questionId });
  if (used) {
    q.active = false; q.archivedAt = new Date();
    await q.save();
    return res.json({ success: true, data: { archived: true, deleted: false, question: q.toFull(), message: 'Question has attempt history, so it was archived instead of deleted.' } });
  }
  await Question.deleteOne({ _id: q._id });
  res.json({ success: true, data: { archived: false, deleted: true, id: q.questionId } });
});
