// scratch/verify_all_fixes.js
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { get } = require('../database/database');
const { signToken } = require('../middleware/auth');

async function verifyAll() {
  console.log('=== Comprehensive Verification Suite ===\n');

  // 1. Check API endpoints against running dev server
  const baseUrl = 'http://127.0.0.1:3000';
  const adminUser = get("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  assert.ok(adminUser, 'Admin user must exist in database');
  const token = signToken(adminUser);

  console.log('1. Testing Receipt API Endpoints:');
  const r1 = await fetch(`${baseUrl}/api/claims/receipt-by-item/13`, { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r1.status, 200, 'receipt-by-item/13 should return 200');
  const d1 = await r1.json();
  assert.ok(d1.receipt && d1.receipt.receiptNumber, 'receipt-by-item should return receipt object');
  console.log('   ✔ GET /api/claims/receipt-by-item/13 returned HTTP 200 with receipt:', d1.receipt.receiptNumber);

  const r2 = await fetch(`${baseUrl}/api/claims/1/receipt`, { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r2.status, 200, '1/receipt should return 200');
  const d2 = await r2.json();
  assert.ok(d2.receipt && d2.receipt.receiptNumber, '1/receipt should return receipt object');
  console.log('   ✔ GET /api/claims/1/receipt returned HTTP 200 with receipt:', d2.receipt.receiptNumber);

  const r3 = await fetch(`${baseUrl}/api/claims/receipt-by-item/99999`, { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r3.status, 404, 'Non-existent item receipt should return 404');
  console.log('   ✔ GET /api/claims/receipt-by-item/99999 cleanly returned HTTP 404');

  const r4 = await fetch(`${baseUrl}/api/claims/99999/receipt`, { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r4.status, 404, 'Non-existent claim receipt should return 404');
  console.log('   ✔ GET /api/claims/99999/receipt cleanly returned HTTP 404');

  // 2. Test Browse Search API Queries
  console.log('\n2. Testing Browse Search Functionality:');
  const s1 = await fetch(`${baseUrl}/api/items?q=backpack`);
  assert.strictEqual(s1.status, 200, 'Search for backpack should return 200');
  const sd1 = await s1.json();
  assert.ok(Array.isArray(sd1.items) && sd1.items.length > 0, 'Should return matching backpack items');
  console.log(`   ✔ GET /api/items?q=backpack returned ${sd1.items.length} item(s)`);

  const s2 = await fetch(`${baseUrl}/api/items?q=black&dateFrom=2024-01-01`);
  assert.strictEqual(s2.status, 200, 'Combined search query should return 200');
  const sd2 = await s2.json();
  assert.ok(Array.isArray(sd2.items) && sd2.items.length > 0, 'Should return matching items for combined query');
  console.log(`   ✔ GET /api/items?q=black&dateFrom=2024-01-01 returned ${sd2.items.length} item(s)`);

  const s3 = await fetch(`${baseUrl}/api/items?q=xyznonexistentitem12345`);
  assert.strictEqual(s3.status, 200, 'Non-matching query should return 200 with empty array');
  const sd3 = await s3.json();
  assert.strictEqual(sd3.items.length, 0, 'Should return 0 items for non-matching query');
  console.log('   ✔ GET /api/items?q=xyznonexistentitem12345 returned empty items array cleanly');

  // 3. Check UI & Navigation Code Integrity
  console.log('\n3. Testing UI & Navigation Code Integrity:');

  const uiJs = fs.readFileSync(path.join(__dirname, '../public/js/ui.js'), 'utf8');
  assert.ok(uiJs.includes('autoMountAdminNav'), 'ui.js has autoMountAdminNav function');
  assert.ok(uiJs.includes('refind_admin_last_page'), 'ui.js tracks refind_admin_last_page');
  assert.ok(!uiJs.includes('Student View</span> ↗'), 'ui.js does NOT show Student View in floating dock for admin');
  assert.ok(!uiJs.includes('Matches &amp; Contact'), 'ui.js admin shortcuts menu removed redundant matches link');
  console.log('   ✔ ui.js cleanly mounts admin shortcuts without unwanted student view dock');

  // 4. Verify PDF Pages (receipt.html & flyer.html)
  console.log('\n4. Verifying PDF Smart Back Navigation:');

  const receiptHtml = fs.readFileSync(path.join(__dirname, '../public/receipt.html'), 'utf8');
  assert.ok(receiptHtml.includes('receipt-back-btn'), 'receipt.html has receipt-back-btn');
  assert.ok(receiptHtml.includes('receipt-close-btn'), 'receipt.html has receipt-close-btn');
  assert.ok(receiptHtml.includes('setupReceiptNavigation'), 'receipt.html has setupReceiptNavigation');
  assert.ok(receiptHtml.includes('smartCloseOrBack'), 'receipt.html has smartCloseOrBack');
  assert.ok(!receiptHtml.includes('secondaryLabel = `🎓 Student View'), 'receipt.html does not push student view to admin');
  console.log('   ✔ receipt.html provides smart back button to admin panel or preserved dashboard tab');

  const flyerHtml = fs.readFileSync(path.join(__dirname, '../public/flyer.html'), 'utf8');
  assert.ok(flyerHtml.includes('flyer-back-btn'), 'flyer.html has flyer-back-btn');
  assert.ok(flyerHtml.includes('flyer-close-btn'), 'flyer.html has flyer-close-btn');
  assert.ok(flyerHtml.includes('setupFlyerNavigation'), 'flyer.html has setupFlyerNavigation');
  assert.ok(flyerHtml.includes('smartCloseOrBack'), 'flyer.html has smartCloseOrBack');
  assert.ok(!flyerHtml.includes('javascript:history.back()'), 'flyer.html replaced javascript:history.back()');
  assert.ok(!flyerHtml.includes('secondaryLabel = `🎓 Student View'), 'flyer.html does not push student view to admin');
  console.log('   ✔ flyer.html provides smart back button and eliminated broken history.back()');

  // 5. Verify Admin Panel Navigation (No Student View, No Matches Tab)
  console.log('\n5. Verifying Admin Panel Navigation (No Student View shortcut, No redundant Matches tab):');

  const adminDashHtml = fs.readFileSync(path.join(__dirname, '../public/admin/dashboard.html'), 'utf8');
  assert.ok(!adminDashHtml.includes('Student View'), 'admin/dashboard.html has NO student view shortcut in nav');
  assert.ok(!adminDashHtml.includes('/admin/matches.html'), 'admin/dashboard.html sidebar has NO redundant matches link');
  assert.ok(!adminDashHtml.includes('View All Matches →'), 'admin/dashboard.html has NO redundant view all matches link');
  assert.ok(adminDashHtml.includes('priority-table'), 'admin/dashboard.html includes matched item contact desk on overview');
  assert.ok(adminDashHtml.includes('flyer.html?id='), 'admin/dashboard.html has flyer links');
  assert.ok(adminDashHtml.includes('receipt.html?itemId='), 'admin/dashboard.html has receipt links');
  console.log('   ✔ admin/dashboard.html has no student view shortcut and presents matched items directly on overview');

  const adminPages = [
    'items.html', 'claims.html', 'analytics.html', 'recovered.html', 'users.html', 'audit-log.html'
  ];
  for (const page of adminPages) {
    const content = fs.readFileSync(path.join(__dirname, '../public/admin', page), 'utf8');
    assert.ok(!content.includes('Student View'), `${page} navbar has NO Student View shortcut`);
    assert.ok(!content.includes('/admin/matches.html'), `${page} sidebar has NO redundant matches link`);
    assert.ok(content.includes('/admin/items.html'), `${page} sidebar contains Items`);
    assert.ok(content.includes('/admin/claims.html'), `${page} sidebar contains Claims`);
    console.log(`   ✔ public/admin/${page} verified (no student view, no matches tab)`);
  }

  // 6. Verify Dashboard Tab Preservation
  console.log('\n6. Verifying Dashboard Tab Preservation:');

  const dashHtml = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  assert.ok(dashHtml.includes('refind_dash_tab'), 'dashboard.html syncs refind_dash_tab');
  assert.ok(dashHtml.includes('&from=dashboard&tab='), 'dashboard.html passes tab to item, flyer, receipt');
  console.log('   ✔ dashboard.html tracks active tab and passes it across navigation');

  console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY! ===');
}

verifyAll().then(() => {
  // Done
}).catch(err => {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
});
