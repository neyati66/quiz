const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireRole } = require('../middleware/auth');
const auth = require('../controllers/authController');
const qc = require('../controllers/questionController');
const att = require('../controllers/attemptController');
const me = require('../controllers/meController');
const teacher = require('../controllers/teacherController');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: Number(process.env.AUTH_RATE_LIMIT) || 100, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' } } });

// public
router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
router.get('/public/stats', qc.publicStats);
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);

// any logged-in user
router.get('/auth/me', authenticate, auth.me);
router.patch('/auth/me', authenticate, auth.updateMe);

// students (teachers may call them too — harmless, their own data only)
router.get('/questions/due', authenticate, qc.getDue);
router.post('/questions/answer', authenticate, qc.answer);
router.post('/attempts', authenticate, att.submit);
router.get('/attempts', authenticate, att.list);
router.get('/attempts/:id', authenticate, att.getOne);
router.get('/me/data', authenticate, me.data);
router.get('/leaderboard', authenticate, me.leaderboard);

// teacher only: valid JWT (401) + role verified in the DB (403)
router.use('/teacher', authenticate, requireRole('teacher'));
router.post('/teacher/questions', teacher.create);
router.get('/teacher/questions', teacher.list);
router.get('/teacher/questions/:id', teacher.getOne);
router.put('/teacher/questions/:id', teacher.update);
router.delete('/teacher/questions/:id', teacher.remove);

module.exports = router;
