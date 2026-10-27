const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncH } = require('../middleware/error');
const { validateRegister, validateLogin, fail, isStr } = require('../middleware/validate');

const ROUNDS = () => Number(process.env.BCRYPT_ROUNDS) || 10;
// Used so a missing account takes the same time as a wrong password (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 8);

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}

// POST /api/auth/register — ALWAYS creates a student. Any `role` in the body is ignored.
exports.register = asyncH(async (req, res) => {
  const { name, email, password } = validateRegister(req.body || {});
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  const passwordHash = await bcrypt.hash(password, ROUNDS());
  const user = await User.create({ name, email, passwordHash, role: 'student' });
  // Same flow as Phase 1: signup does NOT log the user in; they go to the login page.
  res.status(201).json({ success: true, data: { user: user.toSafeJSON() } });
});

// POST /api/auth/login — students and teachers
exports.login = asyncH(async (req, res) => {
  const { email, password } = validateLogin(req.body || {});
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'BAD_CREDENTIALS', 'Incorrect email or password.');
  res.json({ success: true, data: { token: signToken(user), expiresIn: process.env.JWT_EXPIRES_IN || '2h', user: user.toSafeJSON() } });
});

// GET /api/auth/me
exports.me = asyncH(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toSafeJSON() } });
});

// PATCH /api/auth/me — Phase 1 profile page let the user change their display name
exports.updateMe = asyncH(async (req, res) => {
  const name = (req.body || {}).name;
  if (!isStr(name) || !name.trim() || name.trim().length > 80) fail(['name must be 1-80 characters']);
  req.user.name = name.trim();
  await req.user.save();
  res.json({ success: true, data: { user: req.user.toSafeJSON() } });
});
