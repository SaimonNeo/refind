// scratch/test_notification_fix.js
require('dotenv').config({ override: true });
const assert = require('assert');
const { get, run, all } = require('../database/database');
const { signToken } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

async function testNotificationFix() {
  console.log('=== Testing Notification Single Read vs Read-All ===\n');

  const user = get("SELECT * FROM users LIMIT 1");
  assert.ok(user, 'User exists');
  const token = signToken(user);
  const baseUrl = 'http://127.0.0.1:3000';

  // 1. Create two unread notifications for this user
  const id1 = notificationService.notify(user.id, 'match', 'Test Notification 1', '/dashboard.html');
  const id2 = notificationService.notify(user.id, 'match', 'Test Notification 2', '/dashboard.html');

  // Verify both are unread
  const n1Before = get("SELECT is_read FROM notifications WHERE id = ?", [id1]);
  const n2Before = get("SELECT is_read FROM notifications WHERE id = ?", [id2]);
  assert.strictEqual(n1Before.is_read, 0, 'Notification 1 should be unread');
  assert.strictEqual(n2Before.is_read, 0, 'Notification 2 should be unread');
  console.log(`Created test unread notifications #${id1} and #${id2}`);

  const unreadBefore = notificationService.unreadCount(user.id);

  // 2. Call PATCH /api/notifications/:id/read on id1 ONLY
  console.log(`Calling PATCH /api/notifications/${id1}/read...`);
  const res1 = await fetch(`${baseUrl}/api/notifications/${id1}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(res1.status, 200);
  const data1 = await res1.json();
  console.log('Response:', data1);

  // 3. Verify: id1 is read, but id2 is STILL UNREAD!
  const n1After = get("SELECT is_read FROM notifications WHERE id = ?", [id1]);
  const n2After = get("SELECT is_read FROM notifications WHERE id = ?", [id2]);
  assert.strictEqual(n1After.is_read, 1, 'Notification 1 should be marked as read');
  assert.strictEqual(n2After.is_read, 0, 'Notification 2 MUST REMAIN UNREAD!');
  console.log('✔ Verified: Notification 1 is read (is_read=1) and Notification 2 remains unread (is_read=0)!');

  const unreadAfterSingle = notificationService.unreadCount(user.id);
  assert.strictEqual(unreadAfterSingle, unreadBefore - 1, 'Unread count should have decreased by 1');
  console.log(`✔ Unread count decreased by 1 (was ${unreadBefore}, now ${unreadAfterSingle})`);

  // 4. Test PATCH /api/notifications/read-all
  console.log('Calling PATCH /api/notifications/read-all...');
  const res2 = await fetch(`${baseUrl}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(res2.status, 200);

  const n2AfterAll = get("SELECT is_read FROM notifications WHERE id = ?", [id2]);
  assert.strictEqual(n2AfterAll.is_read, 1, 'Notification 2 should now be read after read-all');
  console.log('✔ Verified: Mark-all-read marks all remaining notifications as read');

  // Clean up test rows
  run("DELETE FROM notifications WHERE id IN (?, ?)", [id1, id2]);
  console.log('Cleaned up test notifications.');

  console.log('\n=== All Notification Tests Passed Successfully! ===');
}

testNotificationFix().then(() => {
  // Allow event loop to drain naturally
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
