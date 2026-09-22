// database/database.js
// Thin synchronous wrapper around Node's built-in node:sqlite module.
// Using the built-in module (Node >= 22.5) avoids native-module build
// issues entirely, which matters a lot for a 3-day competition build.

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'refind.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
} catch (e) {
  // Ignore if unsupported in specific environments
}

function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
}

function migrateSchema() {
  try {
    const userColumns = db.prepare("PRAGMA table_info(users);").all().map(c => c.name);
    if (!userColumns.includes('batch')) {
      db.exec("ALTER TABLE users ADD COLUMN batch TEXT;");
    }
    if (!userColumns.includes('section')) {
      db.exec("ALTER TABLE users ADD COLUMN section TEXT;");
    }
    if (!userColumns.includes('avatar')) {
      db.exec("ALTER TABLE users ADD COLUMN avatar TEXT;");
    }

    // Backfill standard demo users with default avatars, batch, and section if missing
    db.exec(`
      UPDATE users SET batch = '2023', section = 'A', avatar = '/img/avatars/amara.svg' WHERE email = 'student1@campus.edu' AND (avatar IS NULL OR batch IS NULL);
      UPDATE users SET batch = '2023', section = 'B', avatar = '/img/avatars/liam.svg' WHERE email = 'student2@campus.edu' AND (avatar IS NULL OR batch IS NULL);
      UPDATE users SET batch = '2024', section = 'A', avatar = '/img/avatars/priya.svg' WHERE email = 'student3@campus.edu' AND (avatar IS NULL OR batch IS NULL);
      UPDATE users SET batch = 'Staff', section = 'Security', avatar = '/img/avatars/admin.svg' WHERE email = 'admin@campus.edu' AND (avatar IS NULL OR batch IS NULL);
    `);
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

initSchema();
migrateSchema();

/**
 * Run a query that returns rows (SELECT).
 * @param {string} sql
 * @param {Array} params
 * @returns {Array<object>}
 */
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * Run a query that returns a single row.
 */
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

/**
 * Run an INSERT/UPDATE/DELETE statement.
 * Returns { lastInsertRowid, changes }.
 */
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
}

/**
 * Run a function inside a transaction. Rolls back on throw.
 */
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, all, get, run, transaction, DB_PATH };
