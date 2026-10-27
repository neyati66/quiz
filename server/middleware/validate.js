const { AppError } = require('./error');
const { SUBJECTS } = require('../config/constants');

const isStr = (v) => typeof v === 'string';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // same rule as Phase 1 auth.js

function fail(details) { throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', details); }

function validateRegister(b) {
  const errs = [];
  if (!isStr(b.name) || !b.name.trim()) errs.push('name is required');
  else if (b.name.trim().length > 80) errs.push('name must be at most 80 characters');
  if (!isStr(b.email) || !EMAIL_RE.test(b.email.trim())) errs.push('a valid email is required');
  if (!isStr(b.password) || b.password.length < 6) errs.push('password must be at least 6 characters'); // Phase 1 rule
  else if (b.password.length > 128) errs.push('password must be at most 128 characters');
  if (errs.length) fail(errs);
  // NOTE: `role` in the body is deliberately ignored — public registration => student.
  return { name: b.name.trim(), email: b.email.trim().toLowerCase(), password: b.password };
}

function validateLogin(b) {
  if (!isStr(b.email) || !isStr(b.password) || !b.email.trim() || !b.password) fail(['email and password are required']);
  return { email: b.email.trim().toLowerCase(), password: b.password };
}

// body: question fields. `partial` = PUT (any subset), else all required.
function validateQuestion(b, { partial = false } = {}) {
  const errs = [];
  const out = {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has('cat')) {
    if (!isStr(b.cat) || !SUBJECTS.includes(b.cat)) errs.push(`cat must be one of: ${SUBJECTS.join(', ')}`); else out.cat = b.cat;
  }
  if (!partial || has('q')) {
    if (!isStr(b.q) || !b.q.trim()) errs.push('q (question text) is required'); else if (b.q.length > 1000) errs.push('q is too long'); else out.q = b.q.trim();
  }
  if (!partial || has('options')) {
    if (!Array.isArray(b.options) || b.options.length !== 4 || !b.options.every((o) => isStr(o) && o.trim() && o.length <= 300)) {
      errs.push('options must be an array of exactly 4 non-empty strings');
    } else {
      out.options = b.options.map((o) => o.trim());
      if (new Set(out.options).size !== 4) errs.push('options must be 4 distinct values');
    }
  }
  if (!partial || has('correct')) {
    if (!Number.isInteger(b.correct) || b.correct < 0 || b.correct > 3) errs.push('correct must be an integer 0-3 (index into options)'); else out.correct = b.correct;
  }
  if (has('explain')) { if (!isStr(b.explain) || b.explain.length > 2000) errs.push('explain must be a string (max 2000)'); else out.explain = b.explain.trim(); }
  else if (!partial) out.explain = '';
  if (has('active')) { if (typeof b.active !== 'boolean') errs.push('active must be boolean'); else out.active = b.active; }
  if (partial && !Object.keys(out).length && !errs.length) errs.push('no updatable fields supplied');
  if (errs.length) fail(errs);
  return out;
}

module.exports = { validateRegister, validateLogin, validateQuestion, fail, isStr };
