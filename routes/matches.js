// routes/matches.js
const express = require('express');
const { get } = require('../database/database');
const { requireAuth } = require('../middleware/auth');
const matchingEngine = require('../services/matchingEngine');

const router = express.Router();

// GET /api/matches/for-lost-item/:id
router.get('/for-lost-item/:id', requireAuth, (req, res) => {
  const item = get('SELECT * FROM items WHERE id = ?', [req.params.id]);
  if (!item || item.type !== 'lost') return res.status(404).json({ error: 'Lost item not found.' });
  const matches = matchingEngine.getMatchesForLostItem(item.id);
  res.json({ matches });
});

// GET /api/matches/for-found-item/:id
router.get('/for-found-item/:id', requireAuth, (req, res) => {
  const item = get('SELECT * FROM items WHERE id = ?', [req.params.id]);
  if (!item || item.type !== 'found') return res.status(404).json({ error: 'Found item not found.' });
  const matches = matchingEngine.getMatchesForFoundItem(item.id);
  res.json({ matches });
});

// GET /api/matches/:id - a specific match, with authorization check
router.get('/:id', requireAuth, (req, res) => {
  const match = matchingEngine.getMatchById(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match not found.' });

  const lost = get(`
    SELECT i.*, u.name as reporter_name, u.email as reporter_email, u.phone as reporter_phone,
           u.batch as reporter_batch, u.section as reporter_section, u.avatar as reporter_avatar
    FROM items i
    JOIN users u ON u.id = i.user_id
    WHERE i.id = ?
  `, [match.lost_item_id]);

  const found = get(`
    SELECT i.*, u.name as reporter_name, u.email as reporter_email, u.phone as reporter_phone,
           u.batch as reporter_batch, u.section as reporter_section, u.avatar as reporter_avatar
    FROM items i
    JOIN users u ON u.id = i.user_id
    WHERE i.id = ?
  `, [match.found_item_id]);

  const isOwner = req.user.id === lost?.user_id || req.user.id === found?.user_id;
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to view this match.' });
  }

  if (found) delete found.verification_answer_hash;

  res.json({ match, lostItem: lost, foundItem: found });
});

module.exports = router;
