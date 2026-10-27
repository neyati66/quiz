const mongoose = require('mongoose');
const { SESSION_TTL_SECONDS } = require('../config/constants');

// Created by GET /api/questions/due. Remembers WHICH questions were issued to WHOM,
// so POST /api/attempts can reject forged/foreign question ids and double submits.
const lockedSchema = new mongoose.Schema(
  { questionId: String, chosen: { type: Number, default: null }, timeSec: Number, at: Date },
  { _id: false }
);

const quizSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true },
  testNumber: { type: Number, required: true },
  questionIds: { type: [String], required: true },
  locked: { type: [lockedSchema], default: [] }, // answers locked one by one (reveal step)
  submitted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: SESSION_TTL_SECONDS }, // TTL clean-up
});

module.exports = mongoose.model('QuizSession', quizSessionSchema);
