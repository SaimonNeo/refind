// routes/claims.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { all, get, run } = require('../database/database');
const { requireAuth } = require('../middleware/auth');
const verificationService = require('../services/verificationService');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `idproof-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('Unsupported file type for ID proof.'));
    cb(null, true);
  },
});

function confidenceFromVerify(verifyResult, hasVerification) {
  if (!hasVerification) return 20;
  if (verifyResult.passed && verifyResult.exact) return 95;
  if (verifyResult.passed && !verifyResult.exact) return 60;
  return 15;
}

// GET /api/claims/verification-question/:itemId
// Returns only the QUESTION (never the answer).
router.get('/verification-question/:itemId', requireAuth, (req, res) => {
  const item = get('SELECT id, type, verification_question, verification_answer_hash FROM items WHERE id = ?', [req.params.itemId]);
  if (!item || item.type !== 'found') return res.status(404).json({ error: 'Found item not found.' });
  res.json({
    hasVerification: !!item.verification_answer_hash,
    question: item.verification_question || null,
  });
});

// POST /api/claims - submit a claim on a found item
router.post('/', requireAuth, upload.single('idProof'), (req, res) => {
  try {
    const { itemId, answer, phone } = req.body || {};
    if (!itemId) return res.status(400).json({ error: 'itemId is required.' });

    const item = get('SELECT * FROM items WHERE id = ?', [itemId]);
    if (!item || item.type !== 'found') {
      return res.status(404).json({ error: 'Found item not found.' });
    }
    if (item.status === 'claimed' || item.status === 'resolved') {
      return res.status(409).json({ error: 'This item has already been claimed.' });
    }
    if (item.user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot claim an item you reported yourself.' });
    }
    const alreadyClaimed = get(
      `SELECT id FROM claims WHERE item_id = ? AND claimant_id = ? AND status IN ('pending','manual_review','approved')`,
      [item.id, req.user.id]
    );
    if (alreadyClaimed) {
      return res.status(409).json({ error: 'You already have an active claim on this item.' });
    }

    const hasVerification = !!item.verification_answer_hash;
    let verifyResult = { passed: false, exact: false };
    if (hasVerification && answer) {
      verifyResult = verificationService.verifyAnswer(answer, item.verification_answer_hash, null);
    }

    const status = verificationService.decideClaimStatus(verifyResult, hasVerification);
    const confidence = confidenceFromVerify(verifyResult, hasVerification);
    const idProofPath = req.file ? `/uploads/${req.file.filename}` : null;

    const { lastInsertRowid } = run(
      `INSERT INTO claims (item_id, claimant_id, claimant_phone, id_proof_image, verification_answer_submitted, confidence_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, req.user.id, phone || null, idProofPath, answer ? '[submitted]' : null, confidence, status]
    );

    if (status === 'approved') {
      run(`UPDATE items SET status = 'claimed' WHERE id = ?`, [item.id]);
    }

    auditService.log(req.user, 'submit_claim', 'claim', lastInsertRowid, `Claim on item #${item.id}, outcome: ${status}`);

    notificationService.notify(
      item.user_id, 'claim_status',
      `${req.user.name} submitted a claim on "${item.title}" (${status.replace('_', ' ')}).`,
      `/item.html?id=${item.id}`
    );
    notificationService.notify(
      req.user.id, 'claim_status',
      status === 'approved'
        ? `Your claim on "${item.title}" was approved.`
        : `Your claim on "${item.title}" is ${status.replace('_', ' ')}.`,
      `/dashboard.html`
    );

    const claim = get('SELECT * FROM claims WHERE id = ?', [lastInsertRowid]);
    res.status(201).json({ claim });
  } catch (err) {
    console.error('Create claim error:', err.message);
    res.status(400).json({ error: err.message.includes('Unsupported') ? err.message : 'Failed to submit claim.' });
  }
});

// GET /api/claims/mine - claims the current user has submitted
router.get('/mine', requireAuth, (req, res) => {
  const claims = all(
    `SELECT c.*, i.title as item_title, i.category as item_category, i.image as item_image
     FROM claims c JOIN items i ON i.id = c.item_id
     WHERE c.claimant_id = ? ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  res.json({ claims });
});

// GET /api/claims/for-item/:itemId - claims on an item (owner or admin only)
router.get('/for-item/:itemId', requireAuth, (req, res) => {
  const item = get('SELECT * FROM items WHERE id = ?', [req.params.itemId]);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  const claims = all(
    `SELECT c.*, u.name as claimant_name, u.email as claimant_email
     FROM claims c JOIN users u ON u.id = c.claimant_id
     WHERE c.item_id = ? ORDER BY c.created_at DESC`,
    [req.params.itemId]
  );
  res.json({ claims });
});

// POST /api/claims/:id/confirm - claimant confirms they received the item
router.post('/:id/confirm', requireAuth, (req, res) => {
  const claim = get('SELECT * FROM claims WHERE id = ?', [req.params.id]);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });
  if (claim.claimant_id !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });
  if (claim.status !== 'approved') return res.status(400).json({ error: 'Only approved claims can be confirmed.' });

  run(`UPDATE claims SET claimant_confirmed = 1 WHERE id = ?`, [claim.id]);
  run(`UPDATE items SET status = 'resolved' WHERE id = ?`, [claim.item_id]);
  auditService.log(req.user, 'confirm_handover', 'claim', claim.id, 'Claimant confirmed receipt of item.');

  const item = get('SELECT * FROM items WHERE id = ?', [claim.item_id]);
  if (item) {
    notificationService.notify(item.user_id, 'recovery', `"${item.title}" was confirmed recovered by its owner. Thank you for handing it in.`, `/item.html?id=${item.id}`);
  }

  res.json({ success: true });
});

module.exports = router;
