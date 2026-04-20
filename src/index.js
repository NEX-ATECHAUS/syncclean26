require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes      = require('./routes/auth');
const connectorRoutes = require('./routes/connectors');
const aiRoutes        = require('./routes/ai');
const syncRoutes      = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

const limiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Too many auth attempts' } });
app.use('/api/', limiter);
app.use('/api/auth/magic', authLimiter);

app.use('/api/auth',       authRoutes);
app.use('/api/connectors', connectorRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/sync',       syncRoutes);

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Clean'Sync API running on http://localhost:${PORT}`);
});

module.exports = app;
