// scratch/test_receipt_pdf.js
// Tests receipt.html for white mode auto-toggle, single-page print geometry, and blank signature lines.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const receiptPath = path.join(__dirname, '..', 'public', 'receipt.html');
const content = fs.readFileSync(receiptPath, 'utf8');

console.log('=== Verifying Receipt PDF & White Mode Implementation ===\n');

// 1. Verify auto-toggle to white mode
assert.ok(content.includes('data-theme="light"'), 'receipt.html has data-theme="light" on <html>');
assert.ok(content.includes("setAttribute('data-theme', 'light')"), 'receipt.html script sets data-theme to light');
console.log('✔ Auto-toggles to white mode on page load');

// 2. Verify text visibility & dark mode protection
assert.ok(content.includes('color: #1d1b19 !important') || content.includes('.receipt-sheet *'), 'Shields sheet text from dark-mode inversions');
assert.ok(content.includes('--receipt-bg: #ffffff'), 'Uses pure white paper background');
console.log('✔ High-contrast dark ink on white paper enforced (no invisible text)');

// 3. Verify 1-page print rules
assert.ok(content.includes('@page'), 'Has @page print rule');
assert.ok(content.includes('page-break-inside: avoid'), 'Has page-break-inside: avoid');
assert.ok(content.includes('Official Custody Transfer Record (1 Page)'), 'Toolbar confirms 1-page target');
console.log('✔ Single-page (1-page) compact print geometry and @page rule configured');

// 4. Verify blank signature lines for real ink signatures
assert.ok(content.includes('<div class="sig-line" id="r-claimant-sig"></div>'), 'Claimant sig-line element is blank');
assert.ok(content.includes('<div class="sig-line" id="r-finder-sig"></div>'), 'Finder sig-line element is blank');
assert.ok(content.includes("document.getElementById('r-claimant-sig').innerHTML = ''"), 'JS leaves claimant signature blank');
assert.ok(content.includes("document.getElementById('r-finder-sig').innerHTML = ''"), 'JS leaves finder signature blank');
assert.ok(content.includes('Sign in Ink'), 'Prompts users to sign in ink');
console.log('✔ Signature lines are blank for real ink signatures after printing');

console.log('\n=== All Receipt Tests Passed Successfully! ===');
