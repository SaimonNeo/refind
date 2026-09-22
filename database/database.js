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

    // Backfill standard demo users with default avatars, batch, and section
    db.exec(`
      UPDATE users SET batch = '2023', section = 'A', avatar = '/img/avatars/female.svg' WHERE email = 'student1@campus.edu';
      UPDATE users SET batch = '2023', section = 'B', avatar = '/img/avatars/male.svg' WHERE email = 'student2@campus.edu';
      UPDATE users SET batch = '2024', section = 'A', avatar = '/img/avatars/female.svg' WHERE email = 'student3@campus.edu';
      UPDATE users SET batch = 'Staff', section = 'Security', avatar = '/img/avatars/admin.svg' WHERE email = 'admin@campus.edu';
    `);

    // Backfill standard demo items with default images if currently null
    db.exec(`
      UPDATE items SET image = '/img/items/headphones-white.svg' WHERE title LIKE '%headphone%';
      UPDATE items SET image = '/img/items/backpack-black.svg' WHERE (title LIKE '%backpack%' OR title LIKE '%laptop bag%') AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/iphone-blue.svg' WHERE (title LIKE '%iPhone%' OR title LIKE '%i-Phone%') AND (image IS NULL OR image = '' OR image = '/img/items/headphones-white.svg');
      UPDATE items SET image = '/img/items/student-id-card.svg' WHERE title LIKE '%ID card%' AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/calculator-casio.svg' WHERE title LIKE '%calculator%' AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/water-bottle-green.svg' WHERE title LIKE '%water bottle%' AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/umbrella-black.svg' WHERE title LIKE '%umbrella%' AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/wallet-brown.svg' WHERE title LIKE '%wallet%' AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/usb-drive-black.svg' WHERE (title LIKE '%USB%' OR title LIKE '%flash drive%') AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/notebook-blue.svg' WHERE title LIKE '%notebook%' AND (image IS NULL OR image = '');
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
