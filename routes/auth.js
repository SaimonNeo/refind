const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { get, run } = require('../database/database');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// --- Avatar image upload config ---
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('Unsupported image type. Use JPG, PNG, WEBP, or GIF.'));
    cb(null, true);
  },
});

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    student_id: u.student_id,
    batch: u.batch,
    section: u.section,
    avatar: u.avatar,
    bio: u.bio,
    created_at: u.created_at,
  };
}

router.post('/register', upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, password, phone, student_id, batch, section } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const hash = await bcrypt.hash(password, 10);
    const { lastInsertRowid } = run(
      `INSERT INTO users (name, email, password, role, phone, student_id, batch, section, avatar) VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        normalizedEmail,
        hash,
        phone ? String(phone).trim() : null,
        student_id ? String(student_id).trim() : null,
        batch ? String(batch).trim() : null,
        section ? String(section).trim() : null,
        avatarUrl,
      ]
    );

    const user = get('SELECT * FROM users WHERE id = ?', [lastInsertRowid]);
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.suspended) {
      return res.status(403).json({ error: 'This account has been suspended. Contact an administrator.' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/me - edit own profile
router.patch('/me', requireAuth, upload.single('avatar'), (req, res) => {
  try {
    const fields = ['name', 'phone', 'student_id', 'batch', 'section', 'bio'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body && req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(req.body[f] ? String(req.body[f]).trim() : null);
      }
    }
    if (req.file) {
      updates.push('avatar = ?');
      params.push(`/uploads/${req.file.filename}`);
    } else if (req.body && req.body.removeAvatar === 'true') {
      updates.push('avatar = ?');
      params.push(null);
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update.' });
    params.push(req.user.id);
    run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
});

// PATCH /api/auth/me/password - change password
router.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newPassword, 10);
    run('UPDATE users SET password = ? WHERE id = ?', [hash, user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;
