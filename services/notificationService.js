// services/notificationService.js
// Minimal in-app notification system. No external delivery (email/SMS) —
// everything surfaces in the notification center in the UI.

const { run, all, get } = require('../database/database');

function notify(userId, type, message, link = null) {
  if (!userId) return null;
  const uid = Number(userId) || userId;
  const { lastInsertRowid } = run(
    `INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)`,
    [uid, type, message, link]
  );
  return lastInsertRowid;
}

function listForUser(userId, { unreadOnly = false } = {}) {
  const uid = Number(userId) || userId;
  const clause = unreadOnly ? 'AND is_read = 0' : '';
  return all(
    `SELECT * FROM notifications WHERE user_id = ? ${clause} ORDER BY created_at DESC, id DESC LIMIT 50`,
    [uid]
  );
}

function unreadCount(userId) {
  const uid = Number(userId) || userId;
  const row = get(`SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND is_read = 0`, [uid]);
  return row ? row.n : 0;
}

function markRead(userId, notificationId) {
  const nid = Number(notificationId) || notificationId;
  const uid = Number(userId) || userId;
  return run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [nid, uid]);
}

function markAllRead(userId) {
  const uid = Number(userId) || userId;
  return run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [uid]);
}

function deleteNotification(userId, notificationId) {
  const nid = Number(notificationId) || notificationId;
  const uid = Number(userId) || userId;
  return run(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [nid, uid]);
}

function clearAll(userId) {
  const uid = Number(userId) || userId;
  return run(`DELETE FROM notifications WHERE user_id = ?`, [uid]);
}

module.exports = { notify, listForUser, unreadCount, markRead, markAllRead, deleteNotification, clearAll };


