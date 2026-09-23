const fs = require('fs');
const path = require('path');
const assert = require('assert');
const db = require('../database/database');

console.log('=== Verifying Dual-Angle Realistic Photos Implementation ===\n');

// 1. Verify files exist in lost and found directories
const lostFiles = [
  'backpack-lost.jpg',
  'iphone-lost.jpg',
  'student-id-lost.jpg',
  'calculator-lost.jpg',
  'umbrella-lost.jpg',
  'water-bottle-lost.jpg',
  'wallet-lost.jpg',
  'headphones-lost.jpg'
];

const foundFiles = [
  'backpack-found.jpg',
  'iphone-found.jpg',
  'student-id-found.jpg',
  'calculator-found.jpg',
  'umbrella-found.jpg',
  'water-bottle-found.jpg',
  'wallet-found.jpg',
  'headphones-found.jpg'
];

console.log('1. Checking Lost Post (Angle A) images on disk:');
for (const file of lostFiles) {
  const p = path.join(__dirname, '../public/img/items/lost', file);
  assert.ok(fs.existsSync(p), `Lost image ${file} must exist at ${p}`);
  const stats = fs.statSync(p);
  assert.ok(stats.size > 50000, `${file} size must be a real image (>50KB), got ${stats.size} bytes`);
  console.log(`   ✔ ${file} verified (${(stats.size / 1024).toFixed(1)} KB)`);
}

console.log('\n2. Checking Found Post (Angle B) images on disk:');
for (const file of foundFiles) {
  const p = path.join(__dirname, '../public/img/items/found', file);
  assert.ok(fs.existsSync(p), `Found image ${file} must exist at ${p}`);
  const stats = fs.statSync(p);
  assert.ok(stats.size > 50000, `${file} size must be a real image (>50KB), got ${stats.size} bytes`);
  console.log(`   ✔ ${file} verified (${(stats.size / 1024).toFixed(1)} KB)`);
}

// 2. Verify database records have distinct angles for matching items
console.log('\n3. Verifying matching items in database have DIFFERENT angles:');
const matches = [
  { name: 'Backpack', lostId: 1, foundId: 11 },
  { name: 'iPhone 13', lostId: 2, foundId: 12 },
  { name: 'Student ID', lostId: 3, foundId: 13 },
  { name: 'Casio Calculator', lostId: 4, foundId: 14 },
  { name: 'Water Bottle', lostId: 6, foundId: 15 },
  { name: 'Headphones', lostId: 8, foundId: 16 }
];

for (const m of matches) {
  const lostItem = db.get('SELECT * FROM items WHERE id = ?', [m.lostId]);
  const foundItem = db.get('SELECT * FROM items WHERE id = ?', [m.foundId]);

  assert.ok(lostItem, `Lost item ${m.lostId} must exist`);
  assert.ok(foundItem, `Found item ${m.foundId} must exist`);

  assert.ok(lostItem.image.includes('/lost/'), `Lost item ${m.name} must use /lost/ photo angle`);
  assert.ok(foundItem.image.includes('/found/'), `Found item ${m.name} must use /found/ photo angle`);
  assert.notStrictEqual(lostItem.image, foundItem.image, `Lost and Found image paths must be DIFFERENT for ${m.name}`);

  console.log(`   ✔ ${m.name}:`);
  console.log(`      Lost  Angle: ${lostItem.image}`);
  console.log(`      Found Angle: ${foundItem.image}`);
}

console.log('\n=== All Dual-Angle Photo Checks Passed 100%! ===');
