// Usage: set TEACHER_NAME / TEACHER_EMAIL / TEACHER_PASSWORD in .env (or the shell), then: npm run create-teacher
// This is the ONLY way to get a teacher account; public registration always creates students.
// It will not downgrade/alter an existing user's password; it can promote an existing account only with PROMOTE=true.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  const name = (process.env.TEACHER_NAME || 'Teacher').trim();
  const email = (process.env.TEACHER_EMAIL || '').trim().toLowerCase();
  const password = process.env.TEACHER_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('TEACHER_EMAIL is missing or invalid.');
  if (password.length < 8 || password === 'change-me-before-running') throw new Error('Set a real TEACHER_PASSWORD (min 8 chars).');
  await connectDB();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === 'teacher') console.log('Teacher already exists — nothing changed.');
    else if (process.env.PROMOTE === 'true') { existing.role = 'teacher'; await existing.save(); console.log('Existing account promoted to teacher.'); }
    else console.log('A student with that email exists. Re-run with PROMOTE=true to promote it, or use a different email.');
  } else {
    await User.create({ name, email, passwordHash: await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 10), role: 'teacher' });
    console.log(`Teacher account created for ${email}.`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
