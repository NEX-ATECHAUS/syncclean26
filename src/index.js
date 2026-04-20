// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes       = require('./routes/auth');
const connectorRoutes  = require('./routes/connectors');
const aiRoutes         = require('./routes/ai');
const syncRoutes       = require('./routes/sync');
const customRoutes     = require('./routes/custom');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Too many auth attempts' } });
app.use('/api/', limiter);
app.use('/api/auth/magic', authLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/connectors', connectorRoutes);
app.use('/api/custom',     customRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/sync',       syncRoutes);

// Health check
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Clean'Sync API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
