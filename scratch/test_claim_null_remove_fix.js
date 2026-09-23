const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== Verifying Claim & Loading Removal Fixes ===\n');

// 1. Check dashboard.html
const dashHtml = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');

assert.ok(
  !dashHtml.includes("document.getElementById('loading').remove();"),
  'dashboard.html must NOT contain unsafe document.getElementById(\'loading\').remove();'
);
assert.ok(
  dashHtml.includes("const loadingEl = document.getElementById('loading');") &&
  dashHtml.includes("loadingEl.remove();"),
  'dashboard.html must safely check loadingEl existence before removing'
);
assert.ok(
  dashHtml.includes("sessionStorage.setItem('refind_dash_tab', activeTab);") &&
  dashHtml.includes("url.searchParams.set('tab', activeTab);"),
  'dashboard.html must synchronize activeTab to sessionStorage and URL query param on init'
);
console.log('✔ dashboard.html: Safely handles loading element removal across multiple load() invocations and persists active tab');

// 2. Check claim.html
const claimHtml = fs.readFileSync(path.join(__dirname, '../public/claim.html'), 'utf8');

assert.ok(
  claimHtml.includes("sessionStorage.setItem('refind_dash_tab', 'claims');"),
  'claim.html must set refind_dash_tab to claims on claim submission'
);
assert.ok(
  claimHtml.includes('/dashboard.html?tab=claims'),
  'claim.html must link back to dashboard with tab=claims'
);
console.log('✔ claim.html: Directs user to My Claims tab and updates session storage upon claiming');

// 3. Check routes/claims.js and routes/admin.js
const claimsRoute = fs.readFileSync(path.join(__dirname, '../routes/claims.js'), 'utf8');
const adminRoute = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');

assert.ok(
  claimsRoute.includes('/dashboard.html?tab=claims'),
  'routes/claims.js must notify user with link /dashboard.html?tab=claims'
);
assert.ok(
  adminRoute.includes('/dashboard.html?tab=claims'),
  'routes/admin.js must notify user with link /dashboard.html?tab=claims'
);
console.log('✔ routes: Notifications for claim submissions and admin decisions link directly to My Claims tab');

console.log('\nAll verification checks passed successfully!');
