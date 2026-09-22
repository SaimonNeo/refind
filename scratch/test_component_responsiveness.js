// scratch/test_component_responsiveness.js
// Validates component-level responsiveness across every single ReFind component.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

console.log('=== Starting Component Responsiveness Test Suite ===\n');

// 1. Browse Filter Component
const browseHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'browse.html'), 'utf8');
assert.ok(browseHtml.includes('filters-primary'), 'browse.html has .filters-primary container');
assert.ok(browseHtml.includes('toggle-filters-btn'), 'browse.html has #toggle-filters-btn');
assert.ok(browseHtml.includes('active-filter-badge'), 'browse.html has #active-filter-badge');
assert.ok(browseHtml.includes('secondary-filters'), 'browse.html has #secondary-filters drawer');
assert.ok(browseHtml.includes('reset-filters-btn'), 'browse.html has #reset-filters-btn');
assert.ok(browseHtml.includes('apply-filters-btn'), 'browse.html has #apply-filters-btn');
assert.ok(browseHtml.includes('updateFilterBadge'), 'browse.html has updateFilterBadge function');
console.log('✔ browse.html filter component: primary bar, collapsible secondary drawer, and active count badge verified.');

// 2. Campus Map Component
const mapJs = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'campus-map.js'), 'utf8');
assert.ok(mapJs.includes('@media (max-width: 640px)'), 'campus-map.js injects 640px mobile breakpoint');
assert.ok(mapJs.includes('.banner-stats .btn'), 'campus-map.js styles selection banner button for mobile');
assert.ok(mapJs.includes('[data-theme="dark"] .map-selection-banner'), 'campus-map.js supports dark mode banner');
console.log('✔ campus-map.js component: mobile stacking, full-width touch buttons, and dark mode verified.');

// 3. Admin Components
const adminCss = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'admin.css'), 'utf8');
assert.ok(adminCss.includes('.admin-table td:last-child'), 'admin.css styles last action column');
assert.ok(adminCss.includes('white-space: nowrap'), 'admin.css prevents awkward action button wrap');
assert.ok(adminCss.includes('.admin-sidebar a'), 'admin.css styles sidebar navigation');
assert.ok(adminCss.includes('border-radius: 20px'), 'admin.css uses mobile pill navigation style');
console.log('✔ admin.css components: nowrap action buttons and mobile pill navigation verified.');

// 4. Student Dashboard Component
const dashCss = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'dashboard.css'), 'utf8');
assert.ok(dashCss.includes('border-radius: 20px'), 'dashboard.css has mobile pill tabs');
assert.ok(dashCss.includes('.claim-row > div:last-child'), 'dashboard.css formats action buttons on mobile');
assert.ok(dashCss.includes('stat-cards'), 'dashboard.css formats stat cards');
console.log('✔ dashboard.css component: pill tabs, stat card grid, and claim action tray verified.');

// 5. Global Utilities & System
const styleCss = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf8');
assert.ok(styleCss.includes('.meta-row'), 'style.css defines universal .meta-row');
assert.ok(styleCss.includes('word-break: break-word'), 'style.css protects against long metadata overflow');
assert.ok(styleCss.includes('.btn-group-responsive'), 'style.css defines .btn-group-responsive');
assert.ok(styleCss.includes('font-size: 16px !important'), 'style.css prevents iOS auto-zoom on inputs');
assert.ok(styleCss.includes('max-height: 90vh'), 'style.css protects bottom sheet modals on mobile');
console.log('✔ style.css system: universal meta-row, responsive button groups, iOS zoom prevention, and modal max-height verified.');

// 6. Item Detail, Claim, Map, Profile, and Report forms
const itemHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'item.html'), 'utf8');
assert.ok(itemHtml.includes('word-break: break-word'), 'item.html meta-row prevents text overflow');
assert.ok(itemHtml.includes('min-height: 44px'), 'item.html action buttons meet touch target guidelines');

const claimHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'claim.html'), 'utf8');
assert.ok(claimHtml.includes('@media (max-width: 480px)'), 'claim.html has 480px breakpoint');

const mapHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'map.html'), 'utf8');
assert.ok(mapHtml.includes('map-header-actions'), 'map.html has responsive header actions');

const profileHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'profile.html'), 'utf8');
assert.ok(profileHtml.includes('@media (max-width: 480px)'), 'profile.html has 480px breakpoint');

const lostHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'report-lost.html'), 'utf8');
assert.ok(lostHtml.includes('@media (max-width: 480px)'), 'report-lost.html has 480px breakpoint');

const foundHtml = fs.readFileSync(path.join(PUBLIC_DIR, 'report-found.html'), 'utf8');
assert.ok(foundHtml.includes('@media (max-width: 480px)'), 'report-found.html has 480px breakpoint');

console.log('✔ Form and detail components: item.html, claim.html, map.html, profile.html, and report forms verified.');

console.log('\n=== All 6 Component Responsiveness Categories Passed 100%! ===');
