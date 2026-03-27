'use strict';
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories').all());
});

router.post('/', (req, res) => {
  const { name, color = '#6366f1', icon } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)').run(id, name, color, icon || null);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.put('/:id', (req, res) => {
  const { name, color, icon } = req.body;
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?').run(
    name ?? row.name, color ?? row.color, icon !== undefined ? icon : row.icon, req.params.id
  );
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
