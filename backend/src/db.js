'use strict';
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/db.sqlite');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES categories(id),
  estimated_size TEXT NOT NULL DEFAULT 'medium',
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES categories(id),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timelogs (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id),
  title TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  start_time TEXT NOT NULL,
  end_time TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  sleep_start TEXT NOT NULL DEFAULT '23:00',
  sleep_end TEXT NOT NULL DEFAULT '07:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  password_hash TEXT
);
`);

db.prepare(`INSERT OR IGNORE INTO settings (id) VALUES ('default')`).run();

module.exports = db;
