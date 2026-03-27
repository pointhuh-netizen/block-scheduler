'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// GET /api/auth/status
router.get('/status', (req, res) => {
  const settings = db.prepare('SELECT password_hash FROM settings WHERE id = ?').get('default');
  res.json({ setup: !!(settings && settings.password_hash) });
});

// POST /api/auth/setup
router.post('/setup', (req, res) => {
  const settings = db.prepare('SELECT password_hash FROM settings WHERE id = ?').get('default');
  if (settings && settings.password_hash) {
    return res.status(400).json({ error: 'Already set up' });
  }
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password too short' });
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE settings SET password_hash = ? WHERE id = ?').run(hash, 'default');
  const token = jwt.sign({ sub: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const settings = db.prepare('SELECT password_hash FROM settings WHERE id = ?').get('default');
  if (!settings || !settings.password_hash) {
    return res.status(400).json({ error: 'Not set up' });
  }
  const { password } = req.body;
  if (!bcrypt.compareSync(password, settings.password_hash)) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ sub: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

module.exports = router;
