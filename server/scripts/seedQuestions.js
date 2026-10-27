// Usage: npm run seed
// Imports the Phase 1 question bank (server/seed/questions.seed.json, extracted verbatim from js/questions.js).
// SAFE: upserts by questionId with $setOnInsert — existing questions (including teacher edits) are never
// overwritten, and nothing is ever dropped or deleted.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Question = require('../models/Question');
const bank = require('../seed/questions.seed.json');

(async () => {
  await connectDB();
  await Question.init(); // make sure the unique index exists
  const res = await Question.bulkWrite(bank.map((q) => ({
    updateOne: {
      filter: { questionId: q.id },
      update: { $setOnInsert: { questionId: q.id, cat: q.cat, q: q.q, options: q.options, correct: q.correct, explain: q.explain, active: true, createdBy: null } },
      upsert: true,
    },
  })));
  console.log(`Seed finished. Inserted: ${res.upsertedCount}, already present (left untouched): ${bank.length - res.upsertedCount}`);
  await mongoose.disconnect();
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
