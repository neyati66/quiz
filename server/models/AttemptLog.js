const mongoose = require('mongoose');

// One submitted attempt. Question text/options/correct/explain are SNAPSHOTTED so
// editing or archiving a question later never changes history (Phase 1 did the same).
const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    chosen: { type: Number, default: null },     // null = timed out / no answer
    correct: { type: Boolean, required: true },   // derived on the server
    timeSec: { type: Number, required: true },
    quality: { type: Number, required: true },    // 0..5, from the SM-2 quality rule
    sm2Before: { type: Object, default: null },   // audit: state before this attempt
    sm2After: { type: Object, required: true },   // audit: state written
  },
  { _id: false }
);

const snapshotSchema = new mongoose.Schema(
  { id: String, cat: String, q: String, options: [String], correct: Number, explain: String },
  { _id: false }
);

const attemptLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quizSession: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizSession', required: true, unique: true }, // 1 session -> max 1 attempt
    subject: { type: String, required: true },
    testNumber: { type: Number, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    timeSec: { type: Number, required: true },
    xpGained: { type: Number, required: true },
    questionIds: { type: [String], required: true, index: true },
    questions: { type: [snapshotSchema], required: true },
    answers: { type: [answerSchema], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttemptLog', attemptLogSchema);
