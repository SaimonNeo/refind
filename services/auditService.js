// services/auditService.js
// Lightweight audit trail for admin/security-sensitive actions.

const { run, all } = require('../database/database');

function log(actor, action, targetType, targetId, details = null) {
  run(
    `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`,
    [actor?.id || null, actor?.name || 'system', action, targetType || null, targetId || null, details || null]
  );
}

function recent(limit = 100) {
  return all(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`, [limit]);
}

module.exports = { log, recent };
