'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// GET /api/sessions - List game sessions (most recent first)
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const playerName = req.query.player;

  let query, params;

  if (playerName) {
    query = `
      SELECT id, player_name, score, wave_reached, duration_seconds, result, started_at, ended_at
      FROM game_sessions
      WHERE player_name = ?
      ORDER BY ended_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [playerName, limit, offset];
  } else {
    query = `
      SELECT id, player_name, score, wave_reached, duration_seconds, result, started_at, ended_at
      FROM game_sessions
      ORDER BY ended_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [limit, offset];
  }

  const sessions = db.prepare(query).all(...params);
  const totalQuery = playerName
    ? db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE player_name = ?').get(playerName)
    : db.prepare('SELECT COUNT(*) as count FROM game_sessions').get();

  res.json({
    sessions,
    total: totalQuery.count,
    limit,
    offset,
  });
});

// GET /api/sessions/:id - Get a specific session
router.get('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// POST /api/sessions - Record a completed game session
router.post('/', (req, res) => {
  const { player_name, score, wave_reached, duration_seconds, result, started_at } = req.body;

  if (!player_name || typeof player_name !== 'string' || player_name.trim().length === 0) {
    return res.status(400).json({ error: 'player_name is required' });
  }
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'score must be a non-negative integer' });
  }
  if (!['victory', 'defeat', 'abandoned'].includes(result)) {
    return res.status(400).json({ error: 'result must be victory, defeat, or abandoned' });
  }
  if (!started_at) {
    return res.status(400).json({ error: 'started_at is required (ISO 8601 datetime)' });
  }

  const id = uuidv4();
  const trimmedName = player_name.trim().slice(0, 32);

  db.prepare(`
    INSERT INTO game_sessions (id, player_name, score, wave_reached, duration_seconds, result, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, trimmedName, score, wave_reached || 1, duration_seconds || 0, result, started_at);

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(id);
  res.status(201).json(session);
});

module.exports = router;
