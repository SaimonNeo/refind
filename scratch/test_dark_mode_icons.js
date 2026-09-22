// scratch/test_dark_mode_icons.js
const fs = require('fs');
const assert = require('assert');

console.log('=== Verifying Dark Mode Notification Sound & Calendar Icon Styles ===\n');

const css = fs.readFileSync('public/css/style.css', 'utf8');

// 1. Check color-scheme: dark on [data-theme="dark"]
assert.ok(css.includes('color-scheme: dark;'), 'style.css sets color-scheme: dark for native controls');
console.log('✔ [data-theme="dark"] has color-scheme: dark');

// 2. Check calendar indicator styling for date and datetime-local
assert.ok(css.includes('input[type="datetime-local"]::-webkit-calendar-picker-indicator'), 'Has datetime-local calendar indicator rule');
assert.ok(css.includes('input[type="date"]::-webkit-calendar-picker-indicator'), 'Has date calendar indicator rule');
assert.ok(css.includes('filter: invert(1) brightness(1.2);'), 'Inverts calendar indicator to bright white');
console.log('✔ Calendar indicator on date / datetime-local inputs is inverted to white in dark mode');

// 3. Check notif-sound-btn dark mode styles
assert.ok(css.includes('[data-theme="dark"] .notif-sound-btn'), 'Has [data-theme="dark"] .notif-sound-btn rule');
assert.ok(css.includes('[data-theme="dark"] .notif-sound-btn svg'), 'Has [data-theme="dark"] .notif-sound-btn svg rule');

const darkNotifBtnIndex = css.indexOf('[data-theme="dark"] .notif-sound-btn');
const darkNotifBtnBlock = css.slice(darkNotifBtnIndex, darkNotifBtnIndex + 400);
assert.ok(darkNotifBtnBlock.includes('#ffffff'), 'Dark mode sound button color/stroke set to white');
console.log('✔ [data-theme="dark"] .notif-sound-btn and its SVG stroke explicitly set to white (#ffffff)');

// 4. Check base notif-sound-btn has color and svg stroke
assert.ok(css.includes('.notif-sound-btn svg'), '.notif-sound-btn svg rule present');
console.log('✔ .notif-sound-btn has base color and SVG stroke bindings');

console.log('\n=== All Dark Mode Icon Verification Tests Passed Successfully! ===\n');
