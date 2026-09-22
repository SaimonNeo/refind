// scratch/test_receipt_http.js
require('dotenv').config({ override: true });
const { get } = require('../database/database');
const { signToken } = require('../middleware/auth');

async function runTest() {
  const baseUrl = `http://127.0.0.1:3000`;

  const adminUser = get("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  if (!adminUser) throw new Error('No admin user');
  const token = signToken(adminUser);

  console.log('Testing GET /api/claims/receipt-by-item/13 with Admin token against running dev server...');
  const res1 = await fetch(`${baseUrl}/api/claims/receipt-by-item/13`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status:', res1.status);
  const json1 = await res1.json();
  console.log('Receipt response receiptNumber:', json1.receipt?.receiptNumber);
  if (res1.status !== 200 || !json1.receipt) {
    throw new Error('receipt-by-item failed: ' + JSON.stringify(json1));
  }

  console.log('Testing GET /api/claims/1/receipt with Admin token...');
  const res2 = await fetch(`${baseUrl}/api/claims/1/receipt`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status:', res2.status);
  const json2 = await res2.json();
  console.log('Direct claim receiptNumber:', json2.receipt?.receiptNumber);
  if (res2.status !== 200 || !json2.receipt) {
    throw new Error('direct claim receipt failed: ' + JSON.stringify(json2));
  }

  console.log('Testing GET /api/claims/receipt-by-item/99999 (should be 404 without crashing)...');
  const res3 = await fetch(`${baseUrl}/api/claims/receipt-by-item/99999`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status:', res3.status);
  const json3 = await res3.json();
  console.log('404 error message:', json3.error);
  if (res3.status !== 404) {
    throw new Error('Expected 404 but got: ' + res3.status);
  }

  console.log('\n✔ Dev server responded perfectly! All receipt HTTP endpoints succeeded with 0 crashes!');
}

runTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
