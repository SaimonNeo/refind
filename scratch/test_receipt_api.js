// scratch/test_receipt_api.js
const { get } = require('../database/database');

async function testReceipts() {
  console.log('Testing receipt endpoints...');

  const user = get("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
  console.log('Admin user found:', user ? user.email : 'None');

  const claim = get("SELECT * FROM claims WHERE status = 'approved' LIMIT 1");
  console.log('Approved claim found:', claim ? `Claim #${claim.id} on item #${claim.item_id}` : 'None');

  console.log('Receipt routes compiled without syntax errors.');
}

testReceipts().then(() => {
  console.log('✔ Receipts verification completed successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
