const path = require('path');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.disable('x-powered-by');

const allowed = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) { cb(null, !origin || allowed.includes(origin)); }, // same-origin & tools (Postman) have no Origin
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

app.use('/api', routes);
app.use('/api', notFound);

// Serve the existing Phase 1 frontend from the same server (no CORS needed): http://localhost:5000
// Only front-end assets are exposed — never .env, package.json, node_modules or server/ source/seed data.
const root = path.join(__dirname, '..');
const PUBLIC_RE = /^\/(?:[A-Za-z0-9_-]+\.html|styles\.css|js\/[A-Za-z0-9_.-]+\.js|images\/[A-Za-z0-9_.-]+)?$/;
app.use((req, res, next) => (PUBLIC_RE.test(req.path) ? next() : res.status(404).type('text').send('Not found')));
app.use(express.static(root, { index: 'index.html', dotfiles: 'ignore' }));
app.use(errorHandler);

module.exports = app;
