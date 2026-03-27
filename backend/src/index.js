'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

// Strict rate limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.' },
});

// General rate limiter for all API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '너무 많은 요청입니다. 잠시 후 다시 시도하세요.' },
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/categories', apiLimiter, require('./routes/categories'));
app.use('/api/tasks', apiLimiter, require('./routes/tasks'));
app.use('/api/events', apiLimiter, require('./routes/events'));
app.use('/api/timelogs', apiLimiter, require('./routes/timelogs'));
app.use('/api/settings', apiLimiter, require('./routes/settings'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
