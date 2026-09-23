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
// Returns only the QUESTION (never the answer) + anti-brute-force rate limit status.
router.get('/verification-question/:itemId', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Administrators cannot submit ownership claims. Claims can only be filed by student claimants.' });
  }

  const item = get('SELECT id, type, verification_question, verification_answer_hash FROM items WHERE id = ?', [req.params.itemId]);
  if (!item || item.type !== 'found') return res.status(404).json({ error: 'Found item not found.' });

  const attempts = get(
    `SELECT COUNT(*) as count, MAX(attempted_at) as last_attempt
     FROM verification_attempts
     WHERE item_id = ? AND user_id = ? AND passed = 0 AND attempted_at >= datetime('now', '-15 minutes')`,
    [item.id, req.user.id]
  );
  const failedCount = attempts?.count || 0;
  const isLocked = failedCount >= 3;

  res.json({
    hasVerification: !!item.verification_answer_hash,
    question: item.verification_question || null,
    locked: isLocked,
    remainingAttempts: Math.max(0, 3 - failedCount),
    cooldownMinutes: 15,
  });
});

// POST /api/claims - submit a claim on a found item
router.post('/', requireAuth, upload.single('idProof'), (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Administrators cannot submit ownership claims. Claims can only be filed by student claimants.' });
    }

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

    // Anti-brute-force verification check: max 3 failed attempts in 15 mins
    const attempts = get(
      `SELECT COUNT(*) as count
       FROM verification_attempts
       WHERE item_id = ? AND user_id = ? AND passed = 0 AND attempted_at >= datetime('now', '-15 minutes')`,
      [item.id, req.user.id]
    );
    if ((attempts?.count || 0) >= 3) {
      return res.status(429).json({
        error: 'Too many incorrect verification attempts. For security, claims on this item are temporarily locked for 15 minutes. Please try again later or verify in person at the campus Lost & Found desk.',
        locked: true,
      });
    }

    const hasVerification = !!item.verification_answer_hash;
    let verifyResult = { passed: false, exact: false };
    if (hasVerification && answer) {
      verifyResult = verificationService.verifyAnswer(answer, item.verification_answer_hash, null);
      run(
        `INSERT INTO verification_attempts (item_id, user_id, passed) VALUES (?, ?, ?)`,
        [item.id, req.user.id, verifyResult.passed ? 1 : 0]
      );
    }

    const status = verificationService.decideClaimStatus(verifyResult, hasVerification);
    const confidence = confidenceFromVerify(verifyResult, hasVerification);
    const idProofPath = req.file ? `/uploads/${req.file.filename}` : null;

    const claimantPhone = (phone && String(phone).trim()) || req.user.phone || null;

    const { lastInsertRowid } = run(
      `INSERT INTO claims (item_id, claimant_id, claimant_phone, id_proof_image, verification_answer_submitted, confidence_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, req.user.id, claimantPhone, idProofPath, answer ? '[submitted]' : null, confidence, status]
    );

    if (status === 'approved') {
      run(`UPDATE items SET status = 'claimed' WHERE id = ?`, [item.id]);
      run(
        `UPDATE items SET status = 'claimed'
         WHERE id IN (
           SELECT m.lost_item_id FROM matches m
           JOIN items li ON li.id = m.lost_item_id
           WHERE m.found_item_id = ? AND li.user_id = ?
         )`,
        [item.id, req.user.id]
      );
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
      `/dashboard.html?tab=claims`
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
    `SELECT c.*, i.title as item_title, i.category as item_category, i.image as item_image,
            u.name as finder_name, u.phone as finder_phone
     FROM claims c
     JOIN items i ON i.id = c.item_id
     JOIN users u ON u.id = i.user_id
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
  run(
    `UPDATE items SET status = 'resolved'
     WHERE id IN (
       SELECT m.lost_item_id FROM matches m
       JOIN items li ON li.id = m.lost_item_id
       WHERE m.found_item_id = ? AND li.user_id = ?
     )`,
    [claim.item_id, claim.claimant_id]
  );
  auditService.log(req.user, 'confirm_handover', 'claim', claim.id, 'Claimant confirmed receipt of item.');

  const item = get('SELECT * FROM items WHERE id = ?', [claim.item_id]);
  if (item) {
    notificationService.notify(item.user_id, 'recovery', `"${item.title}" was confirmed recovered by its owner. Thank you for handing it in.`, `/item.html?id=${item.id}`);
  }

  res.json({ success: true });
});

function getReceiptData(claimId, currentUser) {
  const row = get(
    `SELECT c.*,
            i.id as item_id, i.title as item_title, i.category as item_category, i.color as item_color,
            i.brand as item_brand, i.location as item_location, i.image as item_image,
            i.storage_location as item_storage_location, i.created_at as item_reported_at,
            i.event_date as item_event_date, i.status as item_status, i.type as item_type,
            cu.id as claimant_user_id, cu.name as claimant_name, cu.email as claimant_email,
            cu.phone as claimant_user_phone, cu.student_id as claimant_student_id,
            fu.id as finder_user_id, fu.name as finder_name, fu.email as finder_email,
            fu.phone as finder_phone, fu.student_id as finder_student_id
     FROM claims c
     JOIN items i ON i.id = c.item_id
     LEFT JOIN users cu ON cu.id = c.claimant_id
     LEFT JOIN users fu ON fu.id = i.user_id
     WHERE c.id = ?`,
    [claimId]
  );

  if (!row) return { error: 'Claim not found.', status: 404 };

  const isClaimant = row.claimant_id === currentUser.id;
  const isFinder = row.finder_user_id === currentUser.id;
  const isAdmin = currentUser.role === 'admin';

  if (!isClaimant && !isFinder && !isAdmin) {
    return { error: 'You are not authorized to view this receipt.', status: 403 };
  }

  const receipt = {
    receiptNumber: `REC-${String(row.id).padStart(5, '0')}`,
    claimId: row.id,
    claimStatus: row.status,
    claimantConfirmed: !!row.claimant_confirmed,
    confidenceScore: row.confidence_score,
    handoverLocation: row.handover_location || row.item_storage_location || 'Campus Lost & Found Desk',
    handoverDatetime: row.handover_datetime || row.reviewed_at || row.created_at,
    collectionInstructions: row.collection_instructions || 'Present student ID upon custody release.',
    issuedAt: new Date().toISOString(),
    item: {
      id: row.item_id,
      title: row.item_title,
      category: row.item_category,
      color: row.item_color,
      brand: row.item_brand,
      location: row.item_location,
      image: row.item_image,
      reportedAt: row.item_reported_at,
      status: row.item_status,
      type: row.item_type,
    },
    claimant: {
      id: row.claimant_user_id,
      name: row.claimant_name || 'Claimant',
      studentId: row.claimant_student_id || 'Not on file',
      email: row.claimant_email || 'Not on file',
      phone: row.claimant_phone || row.claimant_user_phone || 'Not on file',
    },
    finder: {
      id: row.finder_user_id,
      name: row.finder_name || 'Campus Finder / Custodian',
      studentId: row.finder_student_id || 'Not on file',
      email: row.finder_email || 'Not on file',
      phone: row.finder_phone || 'Not on file',
    },
  };

  return { receipt, status: 200 };
}

// GET /api/claims/:id/receipt - generates official custody release & handover receipt data
router.get('/:id/receipt', requireAuth, (req, res) => {
  const result = getReceiptData(req.params.id, req.user);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  res.json({ receipt: result.receipt });
});

// GET /api/claims/receipt-by-item/:itemId - fetch receipt for the item's approved claim
router.get('/receipt-by-item/:itemId', requireAuth, (req, res) => {
  let claim = get(
    `SELECT id FROM claims WHERE item_id = ? AND (status = 'approved' OR claimant_confirmed = 1) ORDER BY id DESC LIMIT 1`,
    [req.params.itemId]
  );
  if (!claim) {
    // If itemId was a lost item, check if there was an approved claim on its matching found item
    claim = get(
      `SELECT c.id FROM claims c
       JOIN matches m ON m.found_item_id = c.item_id
       WHERE m.lost_item_id = ? AND (c.status = 'approved' OR c.claimant_confirmed = 1)
       ORDER BY c.id DESC LIMIT 1`,
      [req.params.itemId]
    );
  }
  if (!claim) {
    return res.status(404).json({ error: 'No approved or resolved claim exists for this item yet.' });
  }

  const result = getReceiptData(claim.id, req.user);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  res.json({ receipt: result.receipt });
});

module.exports = router;
