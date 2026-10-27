const mongoose = require('mongoose');

// One document per (student, question) = that student's SM-2 state.
// Fields are exactly what sm2Update() returns in Phase 1.
const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: String, required: true }, // Question.questionId
    ef: { type: Number, required: true },
    reps: { type: Number, required: true },
    interval: { type: Number, required: true },
    nextReview: { type: Number, required: true }, // epoch ms, same as Phase 1
    lastResult: { type: String, enum: ['right', 'wrong'], required: true },
    lastReviewed: { type: Number, required: true },
  },
  { timestamps: true }
);
progressSchema.index({ user: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
