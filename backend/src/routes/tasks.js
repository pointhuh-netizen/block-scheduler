'use strict';
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { status } = req.query;
  if (status) {
    res.json(db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC').all(status));
  } else {
    res.json(db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all());
  }
});

router.post('/', (req, res) => {
  const { title, description, category_id, estimated_size = 'medium', deadline, status = 'pending' } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO tasks (id, title, description, category_id, estimated_size, deadline, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, title, description || null, category_id || null, estimated_size, deadline || null, status, now
  );
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { title, description, category_id, estimated_size, deadline, status } = req.body;
  db.prepare(`UPDATE tasks SET title=?, description=?, category_id=?, estimated_size=?, deadline=?, status=? WHERE id=?`).run(
    title ?? row.title, description !== undefined ? description : row.description,
    category_id !== undefined ? category_id : row.category_id,
    estimated_size ?? row.estimated_size, deadline !== undefined ? deadline : row.deadline,
    status ?? row.status, req.params.id
  );
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.post('/:id/complete', (req, res) => {
  const now = new Date().toISOString();
  const info = db.prepare(`UPDATE tasks SET status='done', completed_at=? WHERE id=?`).run(now, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

module.exports = router;
