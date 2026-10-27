const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./error');

// 401 if no/invalid/expired token. Loads the user from the DB on EVERY request,
// so the role comes from the database — not from whatever the token claims.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required.');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      if (e.name === 'TokenExpiredError') throw new AppError(401, 'TOKEN_EXPIRED', 'Session expired. Please log in again.');
      throw new AppError(401, 'TOKEN_INVALID', 'Invalid token.');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw new AppError(401, 'TOKEN_INVALID', 'Account no longer exists.');
    req.user = user;
    next();
  } catch (err) { next(err); }
}

// 403 unless the DB-verified role matches.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
  }
  next();
};

module.exports = { authenticate, requireRole };
