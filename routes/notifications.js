// routes/notifications.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, (req, res) => {
  const notifications = notificationService.listForUser(req.user.id);
  const unread = notificationService.unreadCount(req.user.id);
  res.json({ notifications, unread });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, (req, res) => {
  notificationService.markRead(req.user.id, req.params.id);
  res.json({ success: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, (req, res) => {
  notificationService.markAllRead(req.user.id);
  res.json({ success: true });
});

module.exports = router;
