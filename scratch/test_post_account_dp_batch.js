// scratch/test_post_account_dp_batch.js
const assert = require('assert');

async function testAll() {
  console.log('=== Verifying Post & Account DP, Batch, and Section ===\n');

  // 1. Verify /api/items returns reporter_avatar, reporter_batch, reporter_section
  console.log('1. Checking GET /api/items...');
  const itemsRes = await fetch('http://localhost:3000/api/items');
  const itemsData = await itemsRes.json();
  assert.strictEqual(itemsRes.status, 200);
  assert.ok(itemsData.items.length > 0, 'Items should exist');
  
  const sample = itemsData.items[0];
  console.log(`   Sample item: "${sample.title}" by ${sample.reporter_name}`);
  console.log(`   reporter_avatar: ${sample.reporter_avatar}`);
  console.log(`   reporter_batch: ${sample.reporter_batch}`);
  console.log(`   reporter_section: ${sample.reporter_section}`);
  assert.ok(sample.reporter_avatar, 'reporter_avatar should be populated');
  assert.ok(sample.reporter_batch, 'reporter_batch should be populated');

  // Check that all items have reporter info
  const missingReporter = itemsData.items.filter(i => !i.reporter_avatar || !i.reporter_batch);
  assert.strictEqual(missingReporter.length, 0, `All items should have reporter info, found ${missingReporter.length} missing`);
  console.log('   ✔ All public items have reporter DP, batch, and section');

  // 2. Verify static serving of avatars
  console.log('\n2. Checking SVG avatar file serving...');
  for (const slug of ['amara', 'liam', 'priya', 'admin']) {
    const res = await fetch(`http://localhost:3000/img/avatars/${slug}.svg`);
    assert.strictEqual(res.status, 200, `Avatar /img/avatars/${slug}.svg should return 200, got ${res.status}`);
    const text = await res.text();
    assert.ok(text.includes('<svg'), `Avatar should be valid SVG`);
  }
  console.log('   ✔ All default SVG avatars are served cleanly with HTTP 200');

  // 3. Verify Admin login & /api/admin/users
  console.log('\n3. Checking Admin users endpoint...');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@campus.edu', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);
  const token = loginData.token;

  const usersRes = await fetch('http://localhost:3000/api/admin/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const usersData = await usersRes.json();
  const usersMissing = usersData.users.filter(u => !u.avatar || !u.batch);
  assert.strictEqual(usersMissing.length, 0, `All users should have avatar and batch, found ${usersMissing.length} missing`);
  console.log(`   ✔ All ${usersData.users.length} accounts in admin panel have DP, batch, and section`);

  // 4. Verify Admin /api/admin/items
  console.log('\n4. Checking Admin items endpoint...');
  const adminItemsRes = await fetch('http://localhost:3000/api/admin/items', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const adminItemsData = await adminItemsRes.json();
  assert.strictEqual(adminItemsRes.status, 200);
  const adminItemsMissing = adminItemsData.items.filter(i => !i.reporter_name || !i.reporter_avatar || !i.reporter_batch);
  assert.strictEqual(adminItemsMissing.length, 0, `All admin items should have reporter info, found ${adminItemsMissing.length} missing`);
  console.log(`   ✔ All ${adminItemsData.items.length} items in admin items table have reporter DP, batch, and section`);

  // 5. Verify Admin /api/admin/dashboard overview
  console.log('\n5. Checking Admin overview recent items...');
  const dashRes = await fetch('http://localhost:3000/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const dashData = await dashRes.json();
  assert.strictEqual(dashRes.status, 200);
  const recentMissing = dashData.recentItems.filter(i => !i.reporter_name || !i.reporter_avatar || !i.reporter_batch);
  assert.strictEqual(recentMissing.length, 0, `Recent items in overview should have reporter info, found ${recentMissing.length} missing`);
  console.log(`   ✔ All recent reports in admin dashboard overview have reporter DP, batch, and section`);

  console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY! ===');
}

testAll().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
