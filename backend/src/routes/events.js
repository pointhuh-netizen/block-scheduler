'use strict';
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { from, to } = req.query;
  let query = 'SELECT * FROM events';
  const params = [];
  if (from && to) {
    query += ' WHERE start_time >= ? AND start_time <= ?';
    params.push(from, to);
  } else if (from) {
    query += ' WHERE start_time >= ?';
    params.push(from);
  } else if (to) {
    query += ' WHERE start_time <= ?';
    params.push(to);
  }
  query += ' ORDER BY start_time ASC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const { title, description, category_id, start_time, end_time } = req.body;
  if (!title || !start_time || !end_time) return res.status(400).json({ error: 'title, start_time, end_time required' });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO events (id, title, description, category_id, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, title, description || null, category_id || null, start_time, end_time, now
  );
  res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { title, description, category_id, start_time, end_time } = req.body;
  db.prepare('UPDATE events SET title=?, description=?, category_id=?, start_time=?, end_time=? WHERE id=?').run(
    title ?? row.title, description !== undefined ? description : row.description,
    category_id !== undefined ? category_id : row.category_id,
    start_time ?? row.start_time, end_time ?? row.end_time, req.params.id
  );
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
