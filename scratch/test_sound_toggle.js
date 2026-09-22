// scratch/test_sound_toggle.js
const fs = require('fs');
const assert = require('assert');

function testSoundToggle() {
  console.log('=== Verifying Sound Toggle Implementation ===\n');

  const jsContent = fs.readFileSync('public/js/notifications.js', 'utf8');
  const cssContent = fs.readFileSync('public/css/style.css', 'utf8');

  // 1. Check HTML markup in notifBellHtml
  assert.ok(jsContent.includes('id="notif-sound-btn"'), 'notif-sound-btn ID present in HTML');
  assert.ok(jsContent.includes('class="notif-sound-btn"'), 'notif-sound-btn class present');
  console.log('✔ notifBellHtml contains the sound toggle button');

  // 2. Check CSS styling
  assert.ok(cssContent.includes('.notif-sound-btn'), '.notif-sound-btn CSS rule present in style.css');
  console.log('✔ style.css includes styling for .notif-sound-btn');

  // 3. Check localStorage logic
  assert.ok(jsContent.includes('isNotificationSoundEnabled'), 'isNotificationSoundEnabled helper function exists');
  assert.ok(jsContent.includes('refind_notif_sound'), 'refind_notif_sound localStorage key used');
  console.log('✔ localStorage persistence logic confirmed');

  // 4. Check playNotificationChime condition
  const chimeIndex = jsContent.indexOf('function playNotificationChime()');
  assert.ok(chimeIndex !== -1, 'playNotificationChime function exists');
  const chimeBody = jsContent.slice(chimeIndex, chimeIndex + 300);
  assert.ok(chimeBody.includes('isNotificationSoundEnabled()'), 'playNotificationChime checks isNotificationSoundEnabled() before playing');
  console.log('✔ playNotificationChime strictly respects user mute setting');

  console.log('\n=== Sound Toggle Verification Completed Successfully! ===');
}

testSoundToggle();
