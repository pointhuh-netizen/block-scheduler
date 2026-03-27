'use strict';
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const row = db.prepare('SELECT id, sleep_start, sleep_end, timezone FROM settings WHERE id = ?').get('default');
  res.json(row);
});

router.put('/', (req, res) => {
  const { sleep_start, sleep_end, timezone } = req.body;
  const row = db.prepare('SELECT * FROM settings WHERE id = ?').get('default');
  db.prepare('UPDATE settings SET sleep_start=?, sleep_end=?, timezone=? WHERE id=?').run(
    sleep_start ?? row.sleep_start, sleep_end ?? row.sleep_end, timezone ?? row.timezone, 'default'
  );
  res.json(db.prepare('SELECT id, sleep_start, sleep_end, timezone FROM settings WHERE id = ?').get('default'));
});

module.exports = router;
