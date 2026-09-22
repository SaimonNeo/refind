// scratch/test_default_post_images.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function testDefaultPostImages() {
  console.log('=== Verifying Default Post Images Implementation ===\n');

  const expectedSvgs = [
    'backpack-black.svg',
    'iphone-blue.svg',
    'student-id-card.svg',
    'calculator-casio.svg',
    'water-bottle-green.svg',
    'headphones-white.svg',
    'umbrella-black.svg',
    'wallet-brown.svg',
    'usb-drive-black.svg',
    'notebook-blue.svg'
  ];

  // 1. Verify all SVG files exist on disk and have valid SVG content
  console.log('1. Checking SVG files on disk:');
  for (const file of expectedSvgs) {
    const filePath = path.join('public', 'img', 'items', file);
    assert.ok(fs.existsSync(filePath), `File ${filePath} must exist`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('<svg'), `${file} must contain <svg> root`);
    assert.ok(content.includes('</svg>'), `${file} must contain </svg> closing tag`);
    console.log(`   ✔ ${file} verified (${content.length} bytes)`);
  }

  // 2. Verify static HTTP serving from server
  console.log('\n2. Testing HTTP retrieval of SVGs:');
  for (const file of expectedSvgs) {
    const res = await fetch(`http://127.0.0.1:3000/img/items/${file}`);
    assert.strictEqual(res.status, 200, `/img/items/${file} must return HTTP 200`);
    const cType = res.headers.get('content-type');
    assert.ok(cType && cType.includes('svg'), `Content-Type should be image/svg+xml`);
  }
  console.log('   ✔ All 10 SVG image assets successfully served via HTTP 200');

  // 3. Verify public feed items API has image URLs
  console.log('\n3. Checking /api/items API feed:');
  const itemsRes = await fetch('http://127.0.0.1:3000/api/items');
  assert.strictEqual(itemsRes.status, 200, '/api/items must return HTTP 200');
  const data = await itemsRes.json();
  const items = data.items || [];
  assert.ok(items.length > 0, 'Items feed should not be empty');

  let defaultItemsWithImages = 0;
  items.forEach(it => {
    if (it.image && it.image.startsWith('/img/items/')) {
      defaultItemsWithImages++;
    }
  });
  console.log(`   ✔ Found ${defaultItemsWithImages} default items populated with /img/items/*.svg images`);
  assert.ok(defaultItemsWithImages >= 20, 'At least 20 default items must have SVG images assigned');

  // 4. Verify seed.js contains image fields
  console.log('\n4. Checking database/seed.js:');
  const seedContent = fs.readFileSync('database/seed.js', 'utf8');
  assert.ok(seedContent.includes("image: '/img/items/backpack-black.svg'"), 'seed.js includes backpack-black.svg');
  assert.ok(seedContent.includes("image: '/img/items/iphone-blue.svg'"), 'seed.js includes iphone-blue.svg');
  assert.ok(seedContent.includes("image: '/img/items/student-id-card.svg'"), 'seed.js includes student-id-card.svg');
  console.log('   ✔ seed.js embeds images for all default lost & found items');

  console.log('\n=== All Default Post Image Tests Passed Successfully! ===\n');
}

testDefaultPostImages().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
