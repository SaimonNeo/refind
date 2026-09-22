// routes/items.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { all, get, run } = require('../database/database');
const { requireAuth } = require('../middleware/auth');
const verificationService = require('../services/verificationService');
const matchingEngine = require('../services/matchingEngine');
const auditService = require('../services/auditService');
const QRCode = require('qrcode');

const router = express.Router();

// --- Image upload config ---
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('Unsupported image type.'));
    cb(null, true);
  },
});

// Strip private verification fields before returning items publicly.
function publicItem(item) {
  if (!item) return item;
  const { verification_question, verification_answer_hash, ...safe } = item;
  return { ...safe, has_verification: !!verification_answer_hash };
}

const VALID_CATEGORIES = new Set([
  'electronics', 'bags', 'accessories', 'documents', 'cards',
  'clothing', 'jewelry', 'keys', 'other',
]);

function validateItemInput(body, { requireFields } = { requireFields: true }) {
  const errors = [];
  const { title, category, location, type } = body;
  if (requireFields) {
    if (!title || !String(title).trim()) errors.push('title is required.');
    if (!category) errors.push('category is required.');
    else if (!VALID_CATEGORIES.has(category)) errors.push(`category must be one of: ${[...VALID_CATEGORIES].join(', ')}.`);
    if (!location || !String(location).trim()) errors.push('location is required.');
    if (!['lost', 'found'].includes(type)) errors.push('type must be "lost" or "found".');
  }
  if (body.description && String(body.description).length > 2000) {
    errors.push('description is too long (max 2000 characters).');
  }
  return errors;
}

// GET /api/items - browse/search with filters
router.get('/', (req, res) => {
  try {
    const { type, category, location, color, brand, q, status, userId, dateFrom, dateTo, sort } = req.query;
    const clauses = [];
    const params = [];

    if (type && ['lost', 'found'].includes(type)) {
      clauses.push('i.type = ?');
      params.push(type);
    }
    if (category) {
      clauses.push('i.category = ?');
      params.push(category);
    }
    if (location) {
      clauses.push('i.location = ?');
      params.push(location);
    }
    if (color) {
      clauses.push('i.color LIKE ?');
      params.push(`%${color}%`);
    }
    if (brand) {
      clauses.push('i.brand LIKE ?');
      params.push(`%${brand}%`);
    }
    if (status) {
      clauses.push('i.status = ?');
      params.push(status);
    } else {
      clauses.push(`i.status NOT IN ('resolved', 'withdrawn')`);
    }
    if (userId) {
      clauses.push('i.user_id = ?');
      params.push(Number(userId));
    }
    if (dateFrom) {
      clauses.push('date(i.created_at) >= date(?)');
      params.push(dateFrom);
    }
    if (dateTo) {
      clauses.push('date(i.created_at) <= date(?)');
      params.push(dateTo);
    }
    if (q) {
      clauses.push('(i.title LIKE ? OR i.description LIKE ? OR i.brand LIKE ? OR i.location LIKE ? OR i.category LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const orderBy = sort === 'oldest' ? 'i.created_at ASC' : 'i.created_at DESC';
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = all(
      `SELECT i.*, u.name as reporter_name, u.phone as reporter_phone, u.avatar as reporter_avatar, u.batch as reporter_batch, u.section as reporter_section
       FROM items i
       JOIN users u ON u.id = i.user_id
       ${where} ORDER BY ${orderBy} LIMIT 200`,
      params
    );
    res.json({ items: rows.map(publicItem) });
  } catch (err) {
    console.error('List items error:', err.message);
    res.status(500).json({ error: 'Failed to list items.' });
  }
});

// GET /api/items/stats/by-location - active item counts per campus building
router.get('/stats/by-location', (req, res) => {
  try {
    const rows = all(`
      SELECT location, type, COUNT(*) as count
      FROM items
      WHERE status NOT IN ('resolved', 'withdrawn')
      GROUP BY lower(trim(location)), type
    `);

    const stats = {};
    for (const row of rows) {
      const locKey = (row.location || '').trim().toLowerCase();
      if (!locKey) continue;
      if (!stats[locKey]) {
        stats[locKey] = { location: row.location, lost: 0, found: 0, total: 0 };
      }
      if (row.type === 'lost') stats[locKey].lost += row.count;
      if (row.type === 'found') stats[locKey].found += row.count;
      stats[locKey].total += row.count;
    }
    res.json({ stats });
  } catch (err) {
    console.error('Location stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch location statistics.' });
  }
});

// GET /api/items/:id/qr.svg - returns SVG QR code for flyer or sharing
router.get('/:id/qr.svg', async (req, res) => {
  try {
    const item = get('SELECT id, title FROM items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).send('Item not found');
    const host = req.get('host');
    const protocol = req.protocol;
    const url = `${protocol}://${host}/item.html?id=${item.id}`;
    const svg = await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      color: { dark: '#262220', light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    console.error('QR code generation error:', err.message);
    res.status(500).send('Error generating QR code');
  }
});

// GET /api/items/:id
router.get('/:id', (req, res) => {
  const item = get(
    `SELECT i.*, u.name as reporter_name, u.phone as reporter_phone, u.avatar as reporter_avatar, u.batch as reporter_batch, u.section as reporter_section
     FROM items i
     JOIN users u ON u.id = i.user_id
     WHERE i.id = ?`,
    [req.params.id]
  );
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  res.json({ item: publicItem(item) });
});

// POST /api/items - create a lost or found report
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const errors = validateItemInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const {
      type, title, category, color, brand, location, description,
      event_date, verification_question, verification_answer, storage_location,
    } = req.body;

    let verificationHash = null;
    let verificationQ = null;
    if (type === 'found' && verification_question && verification_answer) {
      verificationQ = String(verification_question).trim().slice(0, 300);
      verificationHash = verificationService.hashAnswer(verification_answer);
    }

    const image = req.file ? `/uploads/${req.file.filename}` : null;

    // Duplicate-report heuristic: warn, never block.
    const possibleDuplicates = matchingEngine.findLikelyDuplicates(
      req.user.id, type, category, location, title
    );

    const { lastInsertRowid } = run(
      `INSERT INTO items (user_id, type, title, category, color, brand, location, description, image, event_date, storage_location, verification_question, verification_answer_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, type, String(title).trim(), category, color || null, brand || null,
        String(location).trim(), description || null, image, event_date || null,
        type === 'found' ? (storage_location || null) : null,
        verificationQ, verificationHash,
      ]
    );

    const item = get('SELECT * FROM items WHERE id = ?', [lastInsertRowid]);
    auditService.log(req.user, `create_${type}_item`, 'item', item.id, item.title);

    // Kick off matching in the background; don't block the response on AI latency.
    matchingEngine.generateMatchesForItem(item).catch((err) => {
      console.error('Background matching error:', err.message);
    });

    res.status(201).json({
      item: publicItem(item),
      possibleDuplicates: possibleDuplicates.map((d) => ({ id: d.id, title: d.title, created_at: d.created_at })),
    });
  } catch (err) {
    console.error('Create item error:', err.message);
    res.status(400).json({ error: err.message.includes('Unsupported') ? err.message : 'Failed to create item.' });
  }
});

// PATCH /api/items/:id - update own item (owner only), optional new photo
router.patch('/:id', requireAuth, upload.single('image'), (req, res) => {
  try {
    const item = get('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (item.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own items.' });
    }

    const fields = ['title', 'category', 'color', 'brand', 'location', 'description', 'status', 'event_date', 'storage_location'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }
    if (req.file) {
      updates.push('image = ?');
      params.push(`/uploads/${req.file.filename}`);
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update.' });

    params.push(req.params.id);
    run(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`, params);
    auditService.log(req.user, 'update_item', 'item', item.id, `Updated fields: ${updates.map(u => u.split(' =')[0]).join(', ')}`);
    const updated = get('SELECT * FROM items WHERE id = ?', [req.params.id]);
    res.json({ item: publicItem(updated) });
  } catch (err) {
    console.error('Update item error:', err.message);
    res.status(500).json({ error: 'Failed to update item.' });
  }
});

// POST /api/items/:id/withdraw - owner marks their own report as withdrawn
router.post('/:id/withdraw', requireAuth, (req, res) => {
  const item = get('SELECT * FROM items WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only withdraw your own items.' });
  }
  run(`UPDATE items SET status = 'withdrawn' WHERE id = ?`, [item.id]);
  auditService.log(req.user, 'withdraw_item', 'item', item.id, item.title);
  res.json({ success: true });
});

// DELETE /api/items/:id - owner or admin only (permanent removal)
router.delete('/:id', requireAuth, (req, res) => {
  const item = get('SELECT * FROM items WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only delete your own items.' });
  }
  run('DELETE FROM items WHERE id = ?', [req.params.id]);
  auditService.log(req.user, req.user.role === 'admin' && item.user_id !== req.user.id ? 'admin_remove_item' : 'delete_item', 'item', item.id, item.title);
  res.json({ success: true });
});

module.exports = router;
