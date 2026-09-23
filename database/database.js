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

    // Backfill standard demo items with realistic dual-angle photos (Lost Angle A vs Found Angle B)
    db.exec(`
      -- Lost posts (Angle A: upright/front catalog view)
      UPDATE items SET image = '/img/items/lost/backpack-lost.jpg' WHERE type = 'lost' AND (title LIKE '%backpack%' OR title LIKE '%laptop bag%');
      UPDATE items SET image = '/img/items/lost/iphone-lost.jpg' WHERE type = 'lost' AND (title LIKE '%iPhone%' OR title LIKE '%i-Phone%');
      UPDATE items SET image = '/img/items/lost/student-id-lost.jpg' WHERE type = 'lost' AND title LIKE '%ID card%';
      UPDATE items SET image = '/img/items/lost/calculator-lost.jpg' WHERE type = 'lost' AND title LIKE '%calculator%';
      UPDATE items SET image = '/img/items/lost/water-bottle-lost.jpg' WHERE type = 'lost' AND title LIKE '%water bottle%';
      UPDATE items SET image = '/img/items/lost/headphones-lost.jpg' WHERE type = 'lost' AND title LIKE '%headphone%';
      UPDATE items SET image = '/img/items/lost/umbrella-lost.jpg' WHERE type = 'lost' AND title LIKE '%umbrella%';
      UPDATE items SET image = '/img/items/lost/wallet-lost.jpg' WHERE type = 'lost' AND title LIKE '%wallet%';
      UPDATE items SET image = '/img/items/usb-drive-black.svg' WHERE type = 'lost' AND (title LIKE '%USB%' OR title LIKE '%flash drive%') AND (image IS NULL OR image = '');
      UPDATE items SET image = '/img/items/notebook-blue.svg' WHERE type = 'lost' AND title LIKE '%notebook%' AND (image IS NULL OR image = '');

      -- Found posts (Angle B: in-situ / discovery angle)
      UPDATE items SET image = '/img/items/found/backpack-found.jpg' WHERE type = 'found' AND (title LIKE '%backpack%' OR title LIKE '%laptop bag%');
      UPDATE items SET image = '/img/items/found/iphone-found.jpg' WHERE type = 'found' AND (title LIKE '%iPhone%' OR title LIKE '%i-Phone%');
      UPDATE items SET image = '/img/items/found/student-id-found.jpg' WHERE type = 'found' AND title LIKE '%ID card%';
      UPDATE items SET image = '/img/items/found/calculator-found.jpg' WHERE type = 'found' AND title LIKE '%calculator%';
      UPDATE items SET image = '/img/items/found/water-bottle-found.jpg' WHERE type = 'found' AND title LIKE '%water bottle%';
      UPDATE items SET image = '/img/items/found/headphones-found.jpg' WHERE type = 'found' AND title LIKE '%headphone%';
      UPDATE items SET image = '/img/items/found/umbrella-found.jpg' WHERE type = 'found' AND title LIKE '%umbrella%';
      UPDATE items SET image = '/img/items/found/wallet-found.jpg' WHERE type = 'found' AND title LIKE '%wallet%';
      UPDATE items SET image = '/img/items/usb-drive-black.svg' WHERE type = 'found' AND (title LIKE '%USB%' OR title LIKE '%flash drive%') AND (image IS NULL OR image = '');
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
