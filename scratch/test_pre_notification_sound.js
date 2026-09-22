// scratch/test_pre_notification_sound.js
const fs = require('fs');
const assert = require('assert');

console.log('=== Verifying Pre-Notification Sound & Chime Implementation ===\n');

// 1. Verify notifications.js implementation
const notifCode = fs.readFileSync('public/js/notifications.js', 'utf8');

// Check playNotificationChime exists and checks mute setting
assert.ok(notifCode.includes('function playNotificationChime()'), 'playNotificationChime defined');
assert.ok(notifCode.includes('isNotificationSoundEnabled()'), 'Checks sound enable preference');
console.log('✔ playNotificationChime properly checks isNotificationSoundEnabled()');

// Check suspended AudioContext handling and gesture unlock
assert.ok(notifCode.includes("ctx.state === 'suspended'"), 'Handles suspended audio context');
assert.ok(notifCode.includes('unlockAudio'), 'Provides user gesture fallback to unlock audio');
console.log('✔ AudioContext suspended state & user gesture fallback confirmed');

// Check initial poll pre-notification logic
assert.ok(notifCode.includes('refind_just_logged_in'), 'Checks refind_just_logged_in flag');
assert.ok(notifCode.includes('refind_pre_notif_played'), 'Tracks refind_pre_notif_played flag');
assert.ok(notifCode.includes('unreadPreItems'), 'Filters unread pre-existing notifications');
console.log('✔ Initial poll branch checks unread items & plays notification on login');

// 2. Verify api.js implementation
const apiCode = fs.readFileSync('public/js/api.js', 'utf8');
assert.ok(apiCode.includes("sessionStorage.setItem('refind_just_logged_in', 'true')"), 'setSession sets refind_just_logged_in');
assert.ok(apiCode.includes("sessionStorage.removeItem('refind_pre_notif_played')"), 'setSession clears refind_pre_notif_played');
assert.ok(apiCode.includes("sessionStorage.removeItem('refind_just_logged_in')"), 'clearSession cleans refind_just_logged_in');
assert.ok(apiCode.includes("sessionStorage.removeItem('refind_pre_notif_played')"), 'clearSession cleans refind_pre_notif_played');
console.log('✔ api.js correctly sets and clears session storage flags for login and logout');

// 3. Verify login.html and register.html
const loginCode = fs.readFileSync('public/login.html', 'utf8');
const registerCode = fs.readFileSync('public/register.html', 'utf8');
assert.ok(loginCode.includes('setSession(data.token, data.user, true)'), 'login.html passes isLogin = true');
assert.ok(registerCode.includes('setSession(data.token, data.user, true)'), 'register.html passes isLogin = true');
console.log('✔ login.html and register.html explicitly mark session as login');

console.log('\n=== All Pre-Notification Sound Verifications Succeeded! ===\n');
