// scratch/test_notification_suite.js
require('dotenv').config({ override: true });
const assert = require('assert');
const { get, run, all } = require('../database/database');
const { signToken } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

async function testNotificationSuite() {
  console.log('=== Testing Notification Suite Enhancements ===\n');

  const users = all("SELECT * FROM users LIMIT 2");
  assert.strictEqual(users.length, 2, 'Need at least 2 users for isolation tests');
  const [user1, user2] = users;

  const token1 = signToken(user1);
  const token2 = signToken(user2);
  const baseUrl = 'http://127.0.0.1:3000';

  console.log(`Testing with User 1 (id: ${user1.id}, ${user1.name}) and User 2 (id: ${user2.id}, ${user2.name})`);

  // 1. Create different types of notifications for user 1
  const idMatch = notificationService.notify(user1.id, 'match', 'Match notification test', '/matches.html');
  const idClaim = notificationService.notify(user1.id, 'claim_status', 'Claim status test', '/claims.html');
  const idRecovery = notificationService.notify(user1.id, 'recovery', 'Recovery handover test', '/item.html?id=1');
  const idAdmin = notificationService.notify(user1.id, 'admin_decision', 'Admin notice test', '/dashboard.html');

  // Also create a notification for user 2 to test cross-user isolation
  const idUser2 = notificationService.notify(user2.id, 'match', 'User 2 match notification', '/matches.html');

  console.log(`Created User 1 notifications: match #${idMatch}, claim #${idClaim}, recovery #${idRecovery}, admin #${idAdmin}`);
  console.log(`Created User 2 notification: #${idUser2}`);

  // 2. Fetch notifications for user 1
  let res = await fetch(`${baseUrl}/api/notifications`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  assert.strictEqual(res.status, 200);
  let data = await res.json();
  assert.ok(data.notifications.some(n => n.id === idMatch), 'Match notification listed');
  assert.ok(data.notifications.some(n => n.id === idClaim), 'Claim notification listed');
  assert.ok(data.notifications.some(n => n.id === idRecovery), 'Recovery notification listed');
  assert.ok(data.notifications.some(n => n.id === idAdmin), 'Admin notification listed');
  assert.ok(!data.notifications.some(n => n.id === idUser2), 'User 2 notification NOT listed for User 1');
  console.log('✔ GET /api/notifications correctly returns all categories for user 1 with isolation');

  // 3. Mark single notification as read
  console.log(`Testing PATCH /api/notifications/${idMatch}/read...`);
  res = await fetch(`${baseUrl}/api/notifications/${idMatch}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` }
  });
  assert.strictEqual(res.status, 200);
  let patchData = await res.json();
  assert.strictEqual(patchData.success, true);
  const nMatchDb = get("SELECT is_read FROM notifications WHERE id = ?", [idMatch]);
  assert.strictEqual(nMatchDb.is_read, 1, 'Match notification is marked as read in database');
  console.log('✔ PATCH /api/notifications/:id/read marked single item as read');

  // 4. Test DELETE single notification
  console.log(`Testing DELETE /api/notifications/${idClaim}...`);
  res = await fetch(`${baseUrl}/api/notifications/${idClaim}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token1}` }
  });
  assert.strictEqual(res.status, 200);
  let delData = await res.json();
  assert.strictEqual(delData.success, true);
  const nClaimDb = get("SELECT * FROM notifications WHERE id = ?", [idClaim]);
  assert.strictEqual(nClaimDb, undefined, 'Claim notification deleted from database');
  console.log('✔ DELETE /api/notifications/:id successfully deleted notification');

  // Ensure user 1 cannot delete user 2's notification
  console.log(`Testing unauthorized DELETE of User 2's notification by User 1...`);
  res = await fetch(`${baseUrl}/api/notifications/${idUser2}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token1}` }
  });
  assert.strictEqual(res.status, 200);
  const nUser2Db = get("SELECT * FROM notifications WHERE id = ?", [idUser2]);
  assert.ok(nUser2Db, 'User 2 notification MUST NOT be deleted by User 1');
  console.log('✔ Cross-user delete attempt safely blocked (User 2 notification intact)');

  // 5. Test Mark All Read for User 1
  console.log('Testing PATCH /api/notifications/read-all...');
  res = await fetch(`${baseUrl}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` }
  });
  assert.strictEqual(res.status, 200);
  const unreadCount1 = notificationService.unreadCount(user1.id);
  assert.strictEqual(unreadCount1, 0, 'User 1 unread count is 0 after read-all');
  console.log('✔ PATCH /api/notifications/read-all marked all User 1 notifications read');

  // 6. Test DELETE /api/notifications/clear-all
  console.log('Testing DELETE /api/notifications/clear-all...');
  res = await fetch(`${baseUrl}/api/notifications/clear-all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token1}` }
  });
  assert.strictEqual(res.status, 200);
  const remaining1 = notificationService.listForUser(user1.id);
  assert.strictEqual(remaining1.length, 0, 'All User 1 notifications cleared');

  // Ensure User 2 notification is still unaffected
  const remainingUser2 = notificationService.listForUser(user2.id);
  assert.ok(remainingUser2.some(n => n.id === idUser2), 'User 2 notification unaffected by User 1 clear-all');
  console.log('✔ DELETE /api/notifications/clear-all cleared User 1 notifications while isolating User 2');

  // Clean up User 2 test row
  run("DELETE FROM notifications WHERE id = ?", [idUser2]);
  console.log('Cleaned up test row for User 2.');

  console.log('\n=== All Notification Suite Enhancement Tests Passed with 100% Success! ===');
}

testNotificationSuite().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
