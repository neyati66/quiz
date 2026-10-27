const mongoose = require('mongoose');

// Fields mirror Phase 1 questions.js: id, cat, q, options, correct, explain.
// Phase 1 string ids ("h1", "py3"...) are kept as `questionId` (stable, unique).
const questionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true, unique: true, trim: true },
    cat: { type: String, required: true, index: true },        // subject key
    q: { type: String, required: true, trim: true },
    options: { type: [String], required: true },               // exactly 4
    correct: { type: Number, required: true, min: 0, max: 3 }, // index into options
    explain: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },     // false = archived (soft delete)
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = seeded
  },
  { timestamps: true }
);

// What a student may see before answering — never includes `correct` / `explain`.
questionSchema.methods.toPublic = function () {
  return { id: this.questionId, cat: this.cat, q: this.q, options: this.options };
};
// Full view (teacher, or revealed after answering).
questionSchema.methods.toFull = function () {
  return {
    id: this.questionId, cat: this.cat, q: this.q, options: this.options, correct: this.correct,
    explain: this.explain, active: this.active, archivedAt: this.archivedAt,
    createdAt: this.createdAt, updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Question', questionSchema);
