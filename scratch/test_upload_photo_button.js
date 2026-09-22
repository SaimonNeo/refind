// scratch/test_upload_photo_button.js
const fs = require('fs');
const assert = require('assert');

console.log('=== Verifying Upload Photo Button & File Input Implementation ===\n');

// 1. Check register.html
const regHtml = fs.readFileSync('public/register.html', 'utf8');
assert.ok(regHtml.includes('id="avatar"'), 'register.html must contain element with id="avatar"');
assert.ok(regHtml.includes('type="file"'), 'register.html must contain type="file"');
assert.ok(regHtml.includes('accept="image/*"'), 'register.html file input accepts images');
assert.ok(regHtml.includes('id="upload-photo-btn"'), 'register.html has upload-photo-btn id');
assert.ok(regHtml.includes("document.getElementById('avatar').click()"), 'register.html triggers avatar.click()');
console.log('✔ register.html has proper <input type="file" id="avatar"> and upload button handler');

// 2. Check profile.html
const profHtml = fs.readFileSync('public/profile.html', 'utf8');
assert.ok(profHtml.includes('id="avatar"'), 'profile.html must contain element with id="avatar"');
assert.ok(profHtml.includes('type="file"'), 'profile.html must contain type="file"');
assert.ok(profHtml.includes('accept="image/*"'), 'profile.html file input accepts images');
assert.ok(profHtml.includes('id="upload-photo-btn"'), 'profile.html has upload-photo-btn id');
assert.ok(profHtml.includes("document.getElementById('avatar').click()"), 'profile.html triggers avatar.click()');
console.log('✔ profile.html has proper <input type="file" id="avatar"> and upload button handler');

// 3. Verify label for="avatar" matches input
assert.ok(regHtml.includes('label for="avatar"'), 'register.html has label for="avatar"');
assert.ok(profHtml.includes('label for="avatar"'), 'profile.html has label for="avatar"');
console.log('✔ Circular preview label has correct for="avatar" linkage');

console.log('\n=== All Upload Photo Button Tests Passed Successfully! ===\n');
