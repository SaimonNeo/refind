// scratch/test_notification_lifecycle.js
require('dotenv').config({ override: true });
const assert = require('assert');
const { get, run, all } = require('../database/database');
const { signToken } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

async function testNotificationLifecycle() {
  console.log('=== Testing Complete Notification Lifecycle ===\n');

  const user = get("SELECT * FROM users LIMIT 1");
  assert.ok(user, 'User exists');
  const token = signToken(user);
  const baseUrl = 'http://127.0.0.1:3000';

  const baseUnread = notificationService.unreadCount(user.id);
  console.log(`Starting baseline unread count for user ${user.id} (${user.name}): ${baseUnread}`);

  // 1. Create two unread notifications
  const id1 = notificationService.notify(user.id, 'match', 'Test Lifecycle Notification 1', '/item.html?id=1');
  const id2 = notificationService.notify(user.id, 'match', 'Test Lifecycle Notification 2', '/item.html?id=2');
  console.log(`Created Notification 1 (id: ${id1}) and Notification 2 (id: ${id2})`);

  let res = await fetch(`${baseUrl}/api/notifications`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(res.status, 200);
  let data = await res.json();
  assert.strictEqual(data.unread, baseUnread + 2, 'Unread count should include the 2 new notifications');

  // 2. Click / Mark Notification 1 as read
  console.log(`Simulating click on Notification 1 (id: ${id1})...`);
  const patchRes1 = await fetch(`${baseUrl}/api/notifications/${id1}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(patchRes1.status, 200);
  const patchData1 = await patchRes1.json();
  assert.strictEqual(patchData1.success, true);
  assert.strictEqual(patchData1.unread, baseUnread + 1);

  // Verify in database directly
  const n1Db = get("SELECT is_read FROM notifications WHERE id = ?", [id1]);
  const n2Db = get("SELECT is_read FROM notifications WHERE id = ?", [id2]);
  assert.strictEqual(n1Db.is_read, 1, 'Notification 1 must be marked read (is_read=1) in database');
  assert.strictEqual(n2Db.is_read, 0, 'Notification 2 must remain unread (is_read=0) in database');
  console.log('✔ In DB: Notification 1 is_read=1, Notification 2 is_read=0');

  // 3. Now a NEW notification arrives!
  console.log('Simulating a new notification arriving...');
  const id3 = notificationService.notify(user.id, 'claim_status', 'Test Lifecycle Notification 3 (New Arrival)', '/claims.html');
  console.log(`Created Notification 3 (id: ${id3})`);

  // 4. Client polls / refreshes notifications
  console.log('Client polling /api/notifications after Notification 3 arrived...');
  res = await fetch(`${baseUrl}/api/notifications`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(res.status, 200);
  data = await res.json();
  assert.strictEqual(data.unread, baseUnread + 2, 'Unread count should only count unread items (Notification 2 & 3)');

  // Inspect the notifications list returned to the client
  const returnedN1 = data.notifications.find(n => n.id === id1);
  const returnedN2 = data.notifications.find(n => n.id === id2);
  const returnedN3 = data.notifications.find(n => n.id === id3);

  assert.ok(returnedN1, 'Notification 1 returned');
  assert.ok(returnedN2, 'Notification 2 returned');
  assert.ok(returnedN3, 'Notification 3 returned');

  assert.strictEqual(returnedN1.is_read, 1, 'Notification 1 MUST NOT revert to unread!');
  assert.strictEqual(returnedN2.is_read, 0, 'Notification 2 is still unviewed');
  assert.strictEqual(returnedN3.is_read, 0, 'Notification 3 is new and unviewed');
  console.log('✔ Notification 1 remains read (is_read=1) even when Notification 3 arrives!');
  console.log('✔ Only Notification 2 and Notification 3 are unviewed with exact count!');

  // 5. Clean up test rows
  run("DELETE FROM notifications WHERE id IN (?, ?, ?)", [id1, id2, id3]);
  console.log('Cleaned up test notifications.');

  console.log('\n=== All Notification Lifecycle Tests Passed Perfectly! ===');
}

testNotificationLifecycle().catch(err => {
  console.error('Lifecycle test failed:', err);
  process.exit(1);
});
