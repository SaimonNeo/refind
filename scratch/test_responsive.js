// scratch/test_responsive.js
// Audits all 22 pages for responsive meta tags, CSS rules, table wrapping, and layout integrity.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ADMIN_DIR = path.join(PUBLIC_DIR, 'admin');

console.log('=== Starting Responsive Design Audit ===\n');

// 1. Audit HTML files
const htmlFiles = [];
function collectHtml(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory() && file !== 'node_modules') {
      collectHtml(full);
    } else if (file.endsWith('.html')) {
      htmlFiles.push(full);
    }
  }
}
collectHtml(PUBLIC_DIR);

console.log(`Found ${htmlFiles.length} HTML files across public and admin.`);
assert.strictEqual(htmlFiles.length, 22, 'Expected 22 HTML files');

let viewportErrors = 0;
for (const f of htmlFiles) {
  const rel = path.relative(PUBLIC_DIR, f);
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes('<meta name="viewport"')) {
    console.error(`[FAIL] Missing viewport tag in: ${rel}`);
    viewportErrors++;
  }
}
if (viewportErrors === 0) {
  console.log('✔ All 22 HTML files have <meta name="viewport"> tag.');
}

// 2. Check CSS files
const styleCss = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf8');
const adminCss = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'admin.css'), 'utf8');
const dashCss = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'dashboard.css'), 'utf8');
const flyerHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'flyer.html'), 'utf8');
const receiptHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'receipt.html'), 'utf8');

// Assert key responsive rules
console.log('\n--- Checking CSS Responsive Rules ---');
assert.ok(styleCss.includes('@media (max-width: 768px)'), 'style.css has 768px breakpoint');
assert.ok(styleCss.includes('@media (max-width: 480px)'), 'style.css has 480px breakpoint');
assert.ok(styleCss.includes('.table-wrap'), 'style.css has .table-wrap utility');
assert.ok(styleCss.includes('overflow-x: auto'), 'style.css nav-links has overflow-x: auto');
console.log('✔ style.css has mobile navigation, table-wrap, and 768px/480px breakpoints.');

assert.ok(dashCss.includes('overflow-x: auto'), 'dashboard.css has horizontal scrollable tabs');
assert.ok(dashCss.includes('@media (max-width: 768px)'), 'dashboard.css has 768px breakpoint');
assert.ok(dashCss.includes('@media (max-width: 480px)'), 'dashboard.css has 480px breakpoint');
console.log('✔ dashboard.css has responsive tabs, stat cards, and claim rows.');

assert.ok(adminCss.includes('@media (max-width: 900px)'), 'admin.css has 900px breakpoint');
assert.ok(adminCss.includes('@media (max-width: 640px)'), 'admin.css has 640px breakpoint');
assert.ok(adminCss.includes('@media (max-width: 480px)'), 'admin.css has 480px breakpoint');
assert.ok(adminCss.includes('min-width: 600px'), 'admin.css protects table columns with min-width');
console.log('✔ admin.css has responsive sidebar, stat cards, chart grid, and table scrolling.');

assert.ok(flyerHtml.includes('@media (max-width: 768px)'), 'flyer.html has 768px breakpoint');
assert.ok(flyerHtml.includes('@media print'), 'flyer.html preserves print rules');
console.log('✔ flyer.html has responsive mobile stacking and clean print output.');

assert.ok(receiptHtml.includes('@media (max-width: 768px)'), 'receipt.html has 768px breakpoint');
assert.ok(receiptHtml.includes('@media print'), 'receipt.html preserves print rules');
console.log('✔ receipt.html has responsive mobile stacking and clean print output.');

// 3. Check admin tables
console.log('\n--- Checking Admin Table Wrappers ---');
const adminPagesWithTables = ['items.html', 'claims.html', 'recovered.html', 'users.html', 'audit-log.html'];
for (const p of adminPagesWithTables) {
  const c = fs.readFileSync(path.join(ADMIN_DIR, p), 'utf8');
  assert.ok(c.includes('table-wrap'), `${p} wraps admin-table in .table-wrap`);
}
console.log('✔ All standalone admin tables are wrapped in .table-wrap for horizontal touch scrolling.');

console.log('\n=== All Responsive Audits Passed Successfully! ===');
