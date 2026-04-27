'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// Leaderboard handler (top 100 by score)
function leaderboardHandler(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 100, 100);
  const offset = parseInt(req.query.offset) || 0;
  const playerName = req.query.player;

  let query, params;

  if (playerName) {
    query = `
      SELECT id, player_name, score, wave, duration_seconds, created_at
      FROM scores
      WHERE player_name = ?
      ORDER BY wave DESC, score DESC
      LIMIT ? OFFSET ?
    `;
    params = [playerName, limit, offset];
  } else {
    query = `
      SELECT id, player_name, score, wave, duration_seconds, created_at
      FROM scores
      ORDER BY wave DESC, score DESC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  }

  const scores = db.prepare(query).all(...params);

  // Add rank to each entry
  const rankedScores = scores.map((entry, i) => ({
    rank: offset + i + 1,
    playerName: entry.player_name,
    score: entry.score,
    wave: entry.wave,
    createdAt: entry.created_at,
  }));

  res.json(rankedScores);
}

// GET /api/scores/leaderboard - Named leaderboard endpoint (per API spec)
router.get('/leaderboard', leaderboardHandler);

// GET /api/scores - Get leaderboard (top scores, full object list)
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const offset = parseInt(req.query.offset) || 0;
  const playerName = req.query.player;

  let query, params;

  if (playerName) {
    query = `
      SELECT id, player_name, score, wave, duration_seconds, created_at
      FROM scores
      WHERE player_name = ?
      ORDER BY wave DESC, score DESC
      LIMIT ? OFFSET ?
    `;
    params = [playerName, limit, offset];
  } else {
    query = `
      SELECT id, player_name, score, wave, duration_seconds, created_at
      FROM scores
      ORDER BY wave DESC, score DESC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  }

  const scores = db.prepare(query).all(...params);

  const totalQuery = playerName
    ? db.prepare('SELECT COUNT(*) as count FROM scores WHERE player_name = ?').get(playerName)
    : db.prepare('SELECT COUNT(*) as count FROM scores').get();

  res.json({
    scores,
    total: totalQuery.count,
    limit,
    offset,
  });
});

// GET /api/scores/player/:name - Get a player's best score
router.get('/player/:name', (req, res) => {
  const { name } = req.params;

  const best = db.prepare(`
    SELECT id, player_name, score, wave, duration_seconds, created_at
    FROM scores
    WHERE player_name = ?
    ORDER BY wave DESC, score DESC
    LIMIT 1
  `).get(name);

  if (!best) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const rank = db.prepare(`
    SELECT COUNT(*) + 1 as rank
    FROM scores
    WHERE wave > ? OR (wave = ? AND score > ?)
  `).get(best.wave, best.wave, best.score).rank;

  res.json({ ...best, rank });
});

// POST /api/scores - Submit a new score
router.post('/', (req, res) => {
  const { player_name, score, wave, duration_seconds } = req.body;

  if (!player_name || typeof player_name !== 'string' || player_name.trim().length === 0) {
    return res.status(400).json({ error: 'player_name is required' });
  }
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'score must be a non-negative integer' });
  }
  if (wave !== undefined && (typeof wave !== 'number' || !Number.isInteger(wave) || wave < 1)) {
    return res.status(400).json({ error: 'wave must be a positive integer' });
  }

  const id = uuidv4();
  const trimmedName = player_name.trim().slice(0, 32);

  db.prepare(`
    INSERT INTO scores (id, player_name, score, wave, duration_seconds)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, trimmedName, score, wave || 1, duration_seconds || 0);

  const rank = db.prepare(`
    SELECT COUNT(*) + 1 as rank FROM scores WHERE wave > ? OR (wave = ? AND score > ?)
  `).get(wave || 1, wave || 1, score).rank;

  const entry = db.prepare('SELECT * FROM scores WHERE id = ?').get(id);

  res.status(201).json({ ...entry, rank });
});

module.exports = router;
