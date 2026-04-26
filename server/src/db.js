'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'tower_defense.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    wave INTEGER NOT NULL DEFAULT 1,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
  CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_name);

  CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    wave_reached INTEGER NOT NULL DEFAULT 1,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    result TEXT NOT NULL CHECK(result IN ('victory', 'defeat', 'abandoned')),
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_name);
  CREATE INDEX IF NOT EXISTS idx_sessions_ended ON game_sessions(ended_at DESC);
`);

module.exports = db;
