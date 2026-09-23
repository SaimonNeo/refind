// routes/admin.js
const express = require('express');
const { all, get, run } = require('../database/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/dashboard - summary stats
router.get('/dashboard', (req, res) => {
  const totalItems = get('SELECT COUNT(*) as n FROM items').n;
  const lostItems = get(`SELECT COUNT(*) as n FROM items WHERE type = 'lost'`).n;
  const foundItems = get(`SELECT COUNT(*) as n FROM items WHERE type = 'found'`).n;
  const resolved = get(`SELECT COUNT(*) as n FROM items WHERE status = 'resolved' OR status = 'claimed'`).n;
  const pendingClaims = get(`SELECT COUNT(*) as n FROM claims WHERE status IN ('pending', 'manual_review')`).n;
  const rejectedClaims = get(`SELECT COUNT(*) as n FROM claims WHERE status = 'rejected'`).n;
  const activeMatches = get(`SELECT COUNT(*) as n FROM matches WHERE score >= 60`).n;
  const recentItems = all(
    `SELECT i.*, u.name as reporter_name, u.avatar as reporter_avatar, u.batch as reporter_batch, u.section as reporter_section
     FROM items i
     JOIN users u ON u.id = i.user_id
     ORDER BY i.created_at DESC LIMIT 8`
  );
  const highPriority = all(
    `SELECT m.*,
            li.id as lost_id, li.title as lost_title, li.category as lost_category,
            lu.name as lost_user_name, lu.phone as lost_user_phone, lu.email as lost_user_email,
            fi.id as found_id, fi.title as found_title, fi.category as found_category,
            fu.name as found_user_name, fu.phone as found_user_phone, fu.email as found_user_email
     FROM matches m
     JOIN items li ON li.id = m.lost_item_id
     JOIN users lu ON lu.id = li.user_id
     JOIN items fi ON fi.id = m.found_item_id
     JOIN users fu ON fu.id = fi.user_id
     WHERE m.score >= 70 AND li.status = 'active' AND fi.status = 'active'
     ORDER BY m.score DESC LIMIT 10`
  );

  res.json({
    totalItems, lostItems, foundItems,
    successfulRecoveries: resolved,
    pendingClaims, rejectedClaims, activeMatches,
    recentItems, highPriorityCases: highPriority,
  });
});

// GET /api/admin/matches - all scored matches with full reporter contact details
router.get('/matches', (req, res) => {
  const minScore = Number(req.query.minScore) || 50;
  const matches = all(
    `SELECT m.*,
            li.id as lost_id, li.title as lost_title, li.category as lost_category, li.location as lost_location, li.image as lost_image,
            lu.id as lost_user_id, lu.name as lost_user_name, lu.email as lost_user_email, lu.phone as lost_user_phone,
            fi.id as found_id, fi.title as found_title, fi.category as found_category, fi.location as found_location, fi.image as found_image,
            fu.id as found_user_id, fu.name as found_user_name, fu.email as found_user_email, fu.phone as found_user_phone
     FROM matches m
     JOIN items li ON li.id = m.lost_item_id
     JOIN users lu ON lu.id = li.user_id
     JOIN items fi ON fi.id = m.found_item_id
     JOIN users fu ON fu.id = fi.user_id
     WHERE m.score >= ? AND li.status = 'active' AND fi.status = 'active'
     ORDER BY m.score DESC LIMIT 100`,
    [minScore]
  );
  res.json({ matches });
});

// POST /api/admin/matches/:id/notify - admin alerts both parties about the match
router.post('/matches/:id/notify', (req, res) => {
  const match = get(
    `SELECT m.*, li.title as lost_title, li.user_id as lost_user_id,
            fi.title as found_title, fi.user_id as found_user_id
     FROM matches m
     JOIN items li ON li.id = m.lost_item_id
     JOIN items fi ON fi.id = m.found_item_id
     WHERE m.id = ?`,
    [req.params.id]
  );
  if (!match) return res.status(404).json({ error: 'Match not found.' });

  const scorePct = Math.round(match.score);
  notificationService.notify(
    match.lost_user_id,
    'match',
    `Admin recommendation: High-confidence match (${scorePct}%) found for "${match.lost_title}" with found item "${match.found_title}". Check details to coordinate return.`,
    `/matches.html?lostItemId=${match.lost_item_id}`
  );
  notificationService.notify(
    match.found_user_id,
    'match',
    `Admin recommendation: Your found item "${match.found_title}" matched (${scorePct}%) with lost report "${match.lost_title}".`,
    `/matches.html?foundItemId=${match.found_item_id}`
  );

  auditService.log(req.user, 'admin_notify_match', 'match', match.id, `Notified both parties about match #${match.id} (${scorePct}%)`);
  res.json({ success: true, message: 'Notification sent to both reporters.' });
});

// ---- Claims review ----

router.get('/claims', (req, res) => {
  const status = req.query.status;
  const clause = status ? 'WHERE c.status = ?' : '';
  const params = status ? [status] : [];
  const claims = all(
    `SELECT c.*, u.name as claimant_name, u.email as claimant_email,
            i.title as item_title, i.category as item_category, i.status as item_status,
            (
              SELECT m.score
              FROM matches m
              JOIN items li ON li.id = m.lost_item_id
              WHERE m.found_item_id = c.item_id AND li.user_id = c.claimant_id
              ORDER BY m.score DESC LIMIT 1
            ) as match_score,
            (
              SELECT m.ai_score
              FROM matches m
              JOIN items li ON li.id = m.lost_item_id
              WHERE m.found_item_id = c.item_id AND li.user_id = c.claimant_id
              ORDER BY m.score DESC LIMIT 1
            ) as match_ai_score,
            (
              SELECT m.id
              FROM matches m
              JOIN items li ON li.id = m.lost_item_id
              WHERE m.found_item_id = c.item_id AND li.user_id = c.claimant_id
              ORDER BY m.score DESC LIMIT 1
            ) as match_id,
            (
              SELECT li.title
              FROM matches m
              JOIN items li ON li.id = m.lost_item_id
              WHERE m.found_item_id = c.item_id AND li.user_id = c.claimant_id
              ORDER BY m.score DESC LIMIT 1
            ) as lost_title
     FROM claims c
     JOIN users u ON u.id = c.claimant_id
     JOIN items i ON i.id = c.item_id
     ${clause}
     ORDER BY c.created_at DESC`,
    params
  );
  res.json({ claims });
});

// PATCH /api/admin/claims/:id - approve/reject a claim, optionally with handover details
router.patch('/claims/:id', (req, res) => {
  const { status, collection_instructions, handover_location, handover_datetime } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected".' });
  }
  const claim = get('SELECT * FROM claims WHERE id = ?', [req.params.id]);
  if (!claim) return res.status(404).json({ error: 'Claim not found.' });

  run(
    `UPDATE claims SET status = ?, reviewed_at = datetime('now'), collection_instructions = ?, handover_location = ?, handover_datetime = ? WHERE id = ?`,
    [status, collection_instructions || null, handover_location || null, handover_datetime || null, claim.id]
  );
  if (status === 'approved') {
    run(`UPDATE items SET status = 'claimed' WHERE id = ?`, [claim.item_id]);
  }

  auditService.log(req.user, `admin_${status}_claim`, 'claim', claim.id, `Reviewed by admin`);

  const item = get('SELECT * FROM items WHERE id = ?', [claim.item_id]);
  notificationService.notify(
    claim.claimant_id, 'admin_decision',
    status === 'approved'
      ? `An admin approved your claim on "${item?.title}". Check collection details.`
      : `An admin rejected your claim on "${item?.title}".`,
    '/dashboard.html?tab=claims'
  );

  const updated = get('SELECT * FROM claims WHERE id = ?', [claim.id]);
  res.json({ claim: updated });
});

// ---- Items ----

router.get('/items', (req, res) => {
  const items = all(
    `SELECT i.*, u.name as reporter_name, u.avatar as reporter_avatar, u.batch as reporter_batch, u.section as reporter_section
     FROM items i
     JOIN users u ON u.id = i.user_id
     ORDER BY i.created_at DESC LIMIT 500`
  );
  res.json({ items });
});

// DELETE /api/admin/items/:id - remove a fraudulent/inappropriate report
router.delete('/items/:id', (req, res) => {
  const item = get('SELECT * FROM items WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  run('DELETE FROM items WHERE id = ?', [item.id]);
  auditService.log(req.user, 'admin_remove_item', 'item', item.id, item.title);
  res.json({ success: true });
});

// GET /api/admin/recovered - items marked resolved/claimed, for the recovery register
router.get('/recovered', (req, res) => {
  const items = all(
    `SELECT i.*, u.name as reporter_name, u.avatar as reporter_avatar, u.batch as reporter_batch, u.section as reporter_section FROM items i
     JOIN users u ON u.id = i.user_id
     WHERE i.status IN ('claimed', 'resolved')
     ORDER BY i.created_at DESC`
  );
  res.json({ items });
});

// ---- Users ----

router.get('/users', (req, res) => {
  const users = all(
    `SELECT id, name, email, role, phone, student_id, batch, section, avatar, suspended, created_at,
      (SELECT COUNT(*) FROM items WHERE user_id = users.id) as item_count
     FROM users ORDER BY created_at DESC`
  );
  res.json({ users });
});

// PATCH /api/admin/users/:id - suspend / unsuspend
router.patch('/users/:id', (req, res) => {
  const { suspended } = req.body || {};
  if (typeof suspended !== 'boolean') return res.status(400).json({ error: 'suspended must be true or false.' });
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be suspended.' });

  run('UPDATE users SET suspended = ? WHERE id = ?', [suspended ? 1 : 0, user.id]);
  auditService.log(req.user, suspended ? 'suspend_user' : 'unsuspend_user', 'user', user.id, user.email);
  res.json({ success: true });
});

// ---- Audit log ----

router.get('/audit-log', (req, res) => {
  res.json({ entries: auditService.recent(200) });
});

// ---- Analytics ----

router.get('/analytics', (req, res) => {
  const lostVsFound = {
    lost: get(`SELECT COUNT(*) as n FROM items WHERE type = 'lost'`).n,
    found: get(`SELECT COUNT(*) as n FROM items WHERE type = 'found'`).n,
  };
  const byCategory = all(
    `SELECT category, COUNT(*) as count FROM items GROUP BY category ORDER BY count DESC`
  );
  const byLocation = all(
    `SELECT location, COUNT(*) as count FROM items GROUP BY location ORDER BY count DESC`
  );
  const totalItems = get('SELECT COUNT(*) as n FROM items').n;
  const recovered = get(`SELECT COUNT(*) as n FROM items WHERE status IN ('claimed', 'resolved')`).n;
  const recoveryRate = totalItems ? Math.round((recovered / totalItems) * 100) : 0;
  const matchCount = get('SELECT COUNT(*) as n FROM matches').n;
  const strongMatches = get(`SELECT COUNT(*) as n FROM matches WHERE score >= 70`).n;
  const matchSuccessRate = matchCount ? Math.round((strongMatches / matchCount) * 100) : 0;

  res.json({ lostVsFound, byCategory, byLocation, recoveryRate, totalItems, recovered, matchCount, matchSuccessRate });
});

module.exports = router;
