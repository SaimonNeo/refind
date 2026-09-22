// scratch/test_signup_dp_batch_section.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { run } = require('../database/database');

async function runTests() {
  console.log('=== Testing Signup, DP Avatar, Batch, and Section ===\n');

  const testEmail = `student_${Date.now()}@testcampus.edu`;
  const dummyAvatarPath = path.join(__dirname, 'dummy_avatar.png');
  let createdUserId = null;
  let createdItemId = null;
  const createdAvatars = [];
  // Create a minimal 1x1 transparent PNG file
  const minimalPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d040000000049454e44ae426082', 'hex');
  fs.writeFileSync(dummyAvatarPath, minimalPng);

  try {
    // 1. Test Registration with FormData including batch, section, and DP avatar
    console.log('1. Testing registration with avatar DP, batch, and section...');
    const formData = new FormData();
    formData.append('name', 'Alex Mercer');
    formData.append('email', testEmail);
    formData.append('password', 'password123');
    formData.append('student_id', 'STU-9901');
    formData.append('batch', 'Batch 60');
    formData.append('section', 'C');
    formData.append('phone', '+1 555 999 8888');
    const avatarBlob = new Blob([fs.readFileSync(dummyAvatarPath)], { type: 'image/png' });
    formData.append('avatar', avatarBlob, 'my_dp.png');

    const regRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: formData,
    });
    const regData = await regRes.json();
    assert.strictEqual(regRes.status, 201, `Expected status 201, got ${regRes.status}: ${JSON.stringify(regData)}`);
    assert.ok(regData.token, 'Expected token to be returned');
    createdUserId = regData.user.id;
    if (regData.user.avatar) createdAvatars.push(regData.user.avatar);
    assert.strictEqual(regData.user.name, 'Alex Mercer');
    assert.strictEqual(regData.user.student_id, 'STU-9901');
    assert.strictEqual(regData.user.batch, 'Batch 60');
    assert.strictEqual(regData.user.section, 'C');
    assert.ok(regData.user.avatar && regData.user.avatar.startsWith('/uploads/'), `Avatar should start with /uploads/, got: ${regData.user.avatar}`);
    console.log('   ✔ Registration succeeded with batch, section, and avatar:', regData.user.avatar);

    const token = regData.token;

    // 2. Test GET /api/auth/me
    console.log('\n2. Testing GET /api/auth/me...');
    const meRes = await fetch('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData.user.batch, 'Batch 60');
    assert.strictEqual(meData.user.section, 'C');
    assert.strictEqual(meData.user.avatar, regData.user.avatar);
    console.log('   ✔ GET /api/auth/me returned correct batch, section, and avatar');

    // 3. Test Avatar Image Accessibility over HTTP
    console.log('\n3. Testing avatar image static serving...');
    const avatarImgRes = await fetch(`http://localhost:3000${meData.user.avatar}`);
    assert.strictEqual(avatarImgRes.status, 200, `Expected avatar HTTP 200, got ${avatarImgRes.status}`);
    console.log('   ✔ Avatar image is directly accessible via HTTP GET');

    // 4. Test PATCH /api/auth/me (updating batch, section, and new avatar)
    console.log('\n4. Testing profile updates with PATCH /api/auth/me...');
    const patchForm = new FormData();
    patchForm.append('name', 'Alex Mercer Jr.');
    patchForm.append('batch', 'Batch 61');
    patchForm.append('section', 'D');
    patchForm.append('phone', '+1 555 999 7777');
    const newAvatarBlob = new Blob([fs.readFileSync(dummyAvatarPath)], { type: 'image/png' });
    patchForm.append('avatar', newAvatarBlob, 'new_dp.png');

    const patchRes = await fetch('http://localhost:3000/api/auth/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: patchForm,
    });
    const patchData = await patchRes.json();
    assert.strictEqual(patchRes.status, 200, `Expected status 200, got ${patchRes.status}: ${JSON.stringify(patchData)}`);
    assert.strictEqual(patchData.user.name, 'Alex Mercer Jr.');
    assert.strictEqual(patchData.user.batch, 'Batch 61');
    assert.strictEqual(patchData.user.section, 'D');
    assert.ok(patchData.user.avatar && patchData.user.avatar !== regData.user.avatar, 'Expected new avatar URL');
    if (patchData.user.avatar) createdAvatars.push(patchData.user.avatar);
    console.log('   ✔ Profile PATCH updated batch, section, and avatar:', patchData.user.avatar);

    // 5. Test reporter details on newly created item
    console.log('\n5. Testing reporter metadata on item reports...');
    const itemForm = new FormData();
    itemForm.append('type', 'lost');
    itemForm.append('title', 'Blue Engineering Notebook');
    itemForm.append('category', 'documents');
    itemForm.append('location', 'Central Library');
    itemForm.append('description', 'Has calculus notes and name sticker');

    const itemRes = await fetch('http://localhost:3000/api/items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: itemForm,
    });
    const itemData = await itemRes.json();
    assert.strictEqual(itemRes.status, 201, `Failed creating item: ${JSON.stringify(itemData)}`);
    const itemId = itemData.item.id;
    createdItemId = itemId;

    const fetchItemRes = await fetch(`http://localhost:3000/api/items/${itemId}`);
    const fetchItemData = await fetchItemRes.json();
    assert.strictEqual(fetchItemData.item.reporter_name, 'Alex Mercer Jr.');
    assert.strictEqual(fetchItemData.item.reporter_batch, 'Batch 61');
    assert.strictEqual(fetchItemData.item.reporter_section, 'D');
    assert.strictEqual(fetchItemData.item.reporter_avatar, patchData.user.avatar);
    console.log('   ✔ Item reporter_avatar, reporter_batch, reporter_section correctly populated');

    // 6. Test Admin users listing includes batch, section, avatar
    console.log('\n6. Testing Admin users listing...');
    const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@campus.edu', password: 'admin123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200);

    const adminUsersRes = await fetch('http://localhost:3000/api/admin/users', {
      headers: { Authorization: `Bearer ${adminLoginData.token}` },
    });
    const adminUsersData = await adminUsersRes.json();
    const createdUserInAdmin = adminUsersData.users.find(u => u.id === regData.user.id);
    assert.ok(createdUserInAdmin, 'Expected created user in admin users list');
    assert.strictEqual(createdUserInAdmin.batch, 'Batch 61');
    assert.strictEqual(createdUserInAdmin.section, 'D');
    assert.strictEqual(createdUserInAdmin.avatar, patchData.user.avatar);
    console.log('   ✔ Admin users list correctly includes batch, section, and avatar');

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    if (fs.existsSync(dummyAvatarPath)) fs.unlinkSync(dummyAvatarPath);
    for (const av of createdAvatars) {
      const fullPath = path.join(__dirname, '..', 'public', av);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
    if (createdItemId) {
      try { run('DELETE FROM items WHERE id = ?', [createdItemId]); } catch (e) {}
    }
    if (createdUserId) {
      try { run('DELETE FROM users WHERE id = ?', [createdUserId]); } catch (e) {}
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
