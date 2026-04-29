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

  CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'failed', 'cancelled')),
    payment_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_orders_order_id ON payment_orders(order_id);
  CREATE INDEX IF NOT EXISTS idx_orders_player ON payment_orders(player_name);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON payment_orders(status);

  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_type TEXT NOT NULL CHECK(product_type IN ('permanent', 'consumable')),
    quantity INTEGER NOT NULL DEFAULT 1,
    purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES payment_orders(order_id)
  );

  CREATE INDEX IF NOT EXISTS idx_purchases_player ON purchases(player_name);
  CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);
`);

module.exports = db;
