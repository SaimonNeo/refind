// services/notificationService.js
// Minimal in-app notification system. No external delivery (email/SMS) —
// everything surfaces in the notification center in the UI.

const { run, all, get } = require('../database/database');

function notify(userId, type, message, link = null) {
  if (!userId) return null;
  const { lastInsertRowid } = run(
    `INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)`,
    [userId, type, message, link]
  );
  return lastInsertRowid;
}

function listForUser(userId, { unreadOnly = false } = {}) {
  const clause = unreadOnly ? 'AND is_read = 0' : '';
  return all(
    `SELECT * FROM notifications WHERE user_id = ? ${clause} ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
}

function unreadCount(userId) {
  return get(`SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND is_read = 0`, [userId]).n;
}

function markRead(userId, notificationId) {
  run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [notificationId, userId]);
}

function markAllRead(userId) {
  run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [userId]);
}

module.exports = { notify, listForUser, unreadCount, markRead, markAllRead };
