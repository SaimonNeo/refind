// scratch/test_male_female_dp.js
const assert = require('assert');
const { run } = require('../database/database');

async function testMaleFemaleDp() {
  console.log('=== Testing Male & Female Default DPs ===\n');

  let testUser1Id = null;
  let testUser2Id = null;

  try {
    // 1. Test registering with default Male DP
    console.log('1. Registering user with Male DP...');
    const regMaleRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jordan Hayes',
        email: `jordan_${Date.now()}@testcampus.edu`,
        password: 'password123',
        defaultAvatar: '/img/avatars/male.svg',
        batch: '2024',
        section: 'B'
      })
    });
    const regMaleData = await regMaleRes.json();
    assert.strictEqual(regMaleRes.status, 201);
    assert.strictEqual(regMaleData.user.avatar, '/img/avatars/male.svg');
    testUser1Id = regMaleData.user.id;
    console.log('   ✔ User successfully registered with Male DP:', regMaleData.user.avatar);

    // 2. Test registering with default Female DP
    console.log('\n2. Registering user with Female DP...');
    const regFemaleRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Taylor Brooks',
        email: `taylor_${Date.now()}@testcampus.edu`,
        password: 'password123',
        defaultAvatar: '/img/avatars/female.svg',
        batch: '2025',
        section: 'A'
      })
    });
    const regFemaleData = await regFemaleRes.json();
    assert.strictEqual(regFemaleRes.status, 201);
    assert.strictEqual(regFemaleData.user.avatar, '/img/avatars/female.svg');
    testUser2Id = regFemaleData.user.id;
    console.log('   ✔ User successfully registered with Female DP:', regFemaleData.user.avatar);

    // 3. Test changing avatar on profile via PATCH /api/auth/me
    console.log('\n3. Testing PATCH /api/auth/me to switch to Female DP...');
    const patchRes = await fetch('http://localhost:3000/api/auth/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regMaleData.token}`
      },
      body: JSON.stringify({
        defaultAvatar: '/img/avatars/female.svg'
      })
    });
    const patchData = await patchRes.json();
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchData.user.avatar, '/img/avatars/female.svg');
    console.log('   ✔ Profile switched to Female DP successfully');

    // 4. Test image serving
    console.log('\n4. Verifying HTTP 200 on /img/avatars/male.svg and female.svg...');
    const mRes = await fetch('http://localhost:3000/img/avatars/male.svg');
    assert.strictEqual(mRes.status, 200);
    const fRes = await fetch('http://localhost:3000/img/avatars/female.svg');
    assert.strictEqual(fRes.status, 200);
    console.log('   ✔ Both avatar images served with 200 OK');

    console.log('\n=== ALL TESTS PASSED! ===');
  } finally {
    if (testUser1Id) {
      try { run('DELETE FROM users WHERE id = ?', [testUser1Id]); } catch (e) {}
    }
    if (testUser2Id) {
      try { run('DELETE FROM users WHERE id = ?', [testUser2Id]); } catch (e) {}
    }
  }
}

testMaleFemaleDp().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
