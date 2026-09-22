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
  const unread = notificationService.unreadCount(req.user.id);
  res.json({ success: true, unread });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, (req, res) => {
  notificationService.markAllRead(req.user.id);
  res.json({ success: true, unread: 0 });
});

// DELETE /api/notifications/clear-all
router.delete('/clear-all', requireAuth, (req, res) => {
  notificationService.clearAll(req.user.id);
  res.json({ success: true, unread: 0 });
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, (req, res) => {
  notificationService.deleteNotification(req.user.id, req.params.id);
  const unread = notificationService.unreadCount(req.user.id);
  res.json({ success: true, unread });
});

module.exports = router;

