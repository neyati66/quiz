class AppError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res, next) { next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`)); }

// Standard error body: { success:false, error:{ code, message, details? } }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let { status = 500, code = 'SERVER_ERROR', message = 'Something went wrong.', details } = err;
  if (err.type === 'entity.parse.failed') { status = 400; code = 'BAD_JSON'; message = 'Request body is not valid JSON.'; }
  else if (err.name === 'CastError') { status = 400; code = 'BAD_ID'; message = 'Invalid id.'; }
  else if (err.name === 'ValidationError' && err.errors) { status = 400; code = 'VALIDATION_ERROR'; message = 'Validation failed.'; details = Object.values(err.errors).map((e) => e.message); }
  else if (err.code === 11000) { status = 409; code = 'DUPLICATE'; message = 'A record with that unique value already exists.'; }
  if (status >= 500) { console.error(err); message = 'Something went wrong.'; details = undefined; } // never leak internals
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}

module.exports = { AppError, asyncH, notFound, errorHandler };
