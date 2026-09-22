// database/seed.js
// Populates ReFind with realistic campus demo data for the competition
// presentation: 3 students + 1 admin, 10+ lost items, 10+ found items,
// several strong matches and a couple of weak ones (to show ranking),
// and a handful of claims in different states.
//
// Run with: npm run seed

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { run, get, all, transaction } = require('./database');
const verificationService = require('../services/verificationService');
const matchingEngine = require('../services/matchingEngine');

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

async function clearData() {
  run('DELETE FROM claims');
  run('DELETE FROM matches');
  run('DELETE FROM items');
  run('DELETE FROM users');
  // Reset autoincrement counters for clean demo IDs.
  try { run(`DELETE FROM sqlite_sequence WHERE name IN ('users','items','matches','claims')`); } catch {}
}

async function seedUsers() {
  const studentPw = await bcrypt.hash('password123', 10);
  const adminPw = await bcrypt.hash('admin123', 10);

  const students = [
    { name: 'Amara Osei', email: 'student1@campus.edu', phone: '+1 555 010 1001', student_id: 'U20231001', batch: '2023', section: 'A', avatar: '/img/avatars/amara.svg' },
    { name: 'Liam Chen', email: 'student2@campus.edu', phone: '+1 555 010 1002', student_id: 'U20231002', batch: '2023', section: 'B', avatar: '/img/avatars/liam.svg' },
    { name: 'Priya Nair', email: 'student3@campus.edu', phone: '+1 555 010 1003', student_id: 'U20231003', batch: '2024', section: 'A', avatar: '/img/avatars/priya.svg' },
  ];

  const studentIds = [];
  for (const s of students) {
    const { lastInsertRowid } = run(
      `INSERT INTO users (name, email, password, role, phone, student_id, batch, section, avatar) VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?)`,
      [s.name, s.email, studentPw, s.phone, s.student_id, s.batch, s.section, s.avatar]
    );
    studentIds.push(lastInsertRowid);
  }

  const { lastInsertRowid: adminId } = run(
    `INSERT INTO users (name, email, password, role, phone, student_id, batch, section, avatar) VALUES (?, ?, ?, 'admin', ?, ?, 'Staff', 'Security', '/img/avatars/admin.svg')`,
    ['Admin', 'admin@campus.edu', adminPw, '+1 555 010 9000', 'ADM-2024-01']
  );

  return { studentIds, adminId };
}

function insertItem(item) {
  let verificationHash = null;
  if (item.verification_answer) {
    verificationHash = verificationService.hashAnswer(item.verification_answer);
  }
  const { lastInsertRowid } = run(
    `INSERT INTO items (user_id, type, title, category, color, brand, location, description, image, status, event_date, verification_question, verification_answer_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.user_id, item.type, item.title, item.category, item.color || null, item.brand || null,
      item.location, item.description || null, item.image || null, item.status || 'active',
      item.event_date || null, item.verification_question || null, verificationHash,
      item.created_at || hoursAgo(0),
    ]
  );
  return lastInsertRowid;
}

async function seedItems({ studentIds }) {
  const [s1, s2, s3] = studentIds;

  const lostItems = [
    {
      user_id: s1, type: 'lost', title: 'Black Lenovo laptop backpack with red keychain',
      category: 'bags', color: 'black', brand: 'Lenovo', location: 'Central Library',
      description: 'Black Lenovo laptop backpack with a red keychain shaped like a cat. Lost near the second floor study area of the Central Library.',
      event_date: hoursAgo(30), created_at: hoursAgo(29),
    },
    {
      user_id: s2, type: 'lost', title: 'iPhone 13, blue case, cracked corner',
      category: 'electronics', color: 'blue', brand: 'Apple', location: 'Cafeteria',
      description: 'iPhone 13 in a blue silicone case with a small crack on the bottom-right corner. Lost during lunch at the Cafeteria.',
      event_date: hoursAgo(12), created_at: hoursAgo(11),
    },
    {
      user_id: s3, type: 'lost', title: 'Student ID card — Priya Nair',
      category: 'cards', color: 'white', location: 'Main Gate',
      description: 'University student ID card, name Priya Nair, lost near the Main Gate turnstiles.',
      event_date: hoursAgo(50), created_at: hoursAgo(49),
    },
    {
      user_id: s1, type: 'lost', title: 'Scientific calculator, Casio, silver',
      category: 'electronics', color: 'silver', brand: 'Casio', location: 'Computer Science Building',
      description: 'Casio fx-991 scientific calculator, silver with a black rubber grip, left in a lecture hall.',
      event_date: hoursAgo(80), created_at: hoursAgo(79),
    },
    {
      user_id: s2, type: 'lost', title: 'Black umbrella with wooden handle',
      category: 'accessories', color: 'black', location: 'Academic Building',
      description: 'Compact black umbrella with a light wood-effect handle, left near the entrance of the Academic Building.',
      event_date: hoursAgo(200), created_at: hoursAgo(199),
    },
    {
      user_id: s3, type: 'lost', title: 'Stainless steel water bottle, green',
      category: 'accessories', color: 'green', location: 'Laboratory',
      description: 'Dark green insulated stainless steel water bottle with a university sticker on the side, left on a lab bench.',
      event_date: hoursAgo(40), created_at: hoursAgo(39),
    },
    {
      user_id: s1, type: 'lost', title: 'Brown leather wallet',
      category: 'accessories', color: 'brown', location: 'Student Center',
      description: 'Brown leather bifold wallet with several cards inside, lost somewhere around the Student Center.',
      event_date: hoursAgo(15), created_at: hoursAgo(14),
    },
    {
      user_id: s2, type: 'lost', title: 'Wireless headphones, white, Sony',
      category: 'electronics', color: 'white', brand: 'Sony', location: 'Auditorium',
      description: 'White Sony WH-CH520 wireless headphones, left on a seat in the Auditorium after an event.',
      event_date: hoursAgo(5), created_at: hoursAgo(4),
    },
    {
      user_id: s3, type: 'lost', title: '32GB USB flash drive, black, SanDisk',
      category: 'electronics', color: 'black', brand: 'SanDisk', location: 'Computer Science Building',
      description: 'Small black SanDisk USB drive with coursework files, lost in a computer lab.',
      event_date: hoursAgo(60), created_at: hoursAgo(59),
    },
    {
      user_id: s1, type: 'lost', title: 'Spiral notebook, blue cover, chemistry notes',
      category: 'documents', color: 'blue', location: 'Academic Building',
      description: 'Blue spiral-bound notebook full of handwritten chemistry notes, left in a classroom.',
      event_date: hoursAgo(90), created_at: hoursAgo(89),
    },
  ];

  const foundItems = [
    {
      user_id: s2, type: 'found', title: 'Dark Lenovo laptop bag with red key ring',
      category: 'bags', color: 'black', brand: 'Lenovo', location: 'Central Library',
      description: 'Dark laptop bag with Lenovo branding and a red key ring attached to the zipper. Found on the second floor of Central Library.',
      event_date: hoursAgo(28), created_at: hoursAgo(27),
      verification_question: "What's the unique identifying detail on the keychain?",
      verification_answer: 'cat shaped red keychain',
    },
    {
      user_id: s3, type: 'found', title: 'Blue-cased iPhone, screen slightly cracked',
      category: 'electronics', color: 'blue', brand: 'Apple', location: 'Cafeteria',
      description: 'iPhone in a blue case found on a cafeteria table, corner of the case looks cracked.',
      event_date: hoursAgo(11), created_at: hoursAgo(10),
      verification_question: 'What is your phone lock screen wallpaper?',
      verification_answer: 'mountain landscape photo',
    },
    {
      user_id: s1, type: 'found', title: 'University student ID card',
      category: 'cards', color: 'white', location: 'Main Gate',
      description: 'A student ID card found near the Main Gate. Handed in to security.',
      event_date: hoursAgo(49), created_at: hoursAgo(48),
      verification_question: 'What is the full name printed on the card?',
      verification_answer: 'priya nair',
    },
    {
      user_id: s2, type: 'found', title: 'Silver Casio calculator',
      category: 'electronics', color: 'silver', brand: 'Casio', location: 'Computer Science Building',
      description: 'Silver scientific calculator with a black grip, found in a CS Building lecture hall.',
      event_date: hoursAgo(78), created_at: hoursAgo(77),
      verification_question: 'Is there anything written or stickered on the back?',
      verification_answer: 'initials written in marker on the back',
    },
    {
      user_id: s3, type: 'found', title: 'Green insulated water bottle',
      category: 'accessories', color: 'green', location: 'Laboratory',
      description: 'Dark green metal water bottle with a sticker, found on a lab bench after class.',
      event_date: hoursAgo(38), created_at: hoursAgo(37),
      verification_question: 'What does the sticker on the bottle say or show?',
      verification_answer: 'university crest sticker',
    },
    {
      user_id: s1, type: 'found', title: 'White wireless headphones',
      category: 'electronics', color: 'white', brand: 'Sony', location: 'Auditorium',
      description: 'White over-ear wireless headphones found under a seat in the Auditorium.',
      event_date: hoursAgo(4), created_at: hoursAgo(3),
      verification_question: 'What color is the carrying pouch, if any?',
      verification_answer: 'no pouch, just the headphones',
    },
    // Weaker / partial matches to demonstrate ranking
    {
      user_id: s2, type: 'found', title: 'Black backpack, no brand visible',
      category: 'bags', color: 'black', location: 'Cafeteria',
      description: 'Plain black backpack found at the Cafeteria, no laptop inside, no visible brand.',
      event_date: hoursAgo(150), created_at: hoursAgo(149),
      verification_question: 'How many exterior pockets does it have?',
      verification_answer: 'two side pockets',
    },
    {
      user_id: s3, type: 'found', title: 'Grey umbrella, slightly bent rib',
      category: 'accessories', color: 'gray', location: 'Student Center',
      description: 'Grey folding umbrella with one bent rib, found near the Student Center entrance.',
      event_date: hoursAgo(210), created_at: hoursAgo(205),
      verification_question: 'Is there a strap or clip to close it?',
      verification_answer: 'velcro strap',
    },
    {
      user_id: s1, type: 'found', title: 'Brown wallet with cards',
      category: 'accessories', color: 'brown', location: 'Main Gate',
      description: 'Brown wallet containing a few cards, found near the Main Gate — different area than usually reported.',
      event_date: hoursAgo(16), created_at: hoursAgo(15),
      verification_question: 'How many cards are inside, roughly?',
      verification_answer: 'about four cards',
    },
    {
      user_id: s2, type: 'found', title: 'Black USB drive',
      category: 'electronics', color: 'black', location: 'Laboratory',
      description: 'Small black USB flash drive found near a lab workstation, brand not clearly visible.',
      event_date: hoursAgo(58), created_at: hoursAgo(57),
      verification_question: 'What brand name, if any, is printed on it?',
      verification_answer: 'sandisk',
    },
  ];

  const lostIds = lostItems.map(insertItem);
  const foundIds = foundItems.map(insertItem);
  return { lostIds, foundIds };
}

async function seedMatches() {
  const lostRows = all(`SELECT * FROM items WHERE type = 'lost'`);
  console.log(`  Generating matches for ${lostRows.length} lost items (fast semantic & deterministic engine)...`);
  const savedKey = process.env.GEMINI_API_KEY;
  if (!process.env.SEED_WITH_AI) {
    process.env.GEMINI_API_KEY = '';
  }
  try {
    for (const lost of lostRows) {
      await matchingEngine.generateMatchesForItem(lost);
    }
  } finally {
    process.env.GEMINI_API_KEY = savedKey;
  }
  const matchCount = get('SELECT COUNT(*) as n FROM matches').n;
  console.log(`  Stored ${matchCount} matches.`);
}

async function seedClaims({ studentIds }) {
  const [s1, s2, s3] = studentIds;

  // A claim that should auto-approve: s2 claims the ID card found by s1,
  // answering with the exact expected answer.
  const idCard = get(`SELECT * FROM items WHERE title LIKE 'University student ID card%'`);
  if (idCard) {
    const verify = verificationService.verifyAnswer('priya nair', idCard.verification_answer_hash, null);
    const status = verificationService.decideClaimStatus(verify, true);
    run(
      `INSERT INTO claims (item_id, claimant_id, verification_answer_submitted, status, created_at) VALUES (?, ?, ?, ?, ?)`,
      [idCard.id, s3, '[submitted]', status, hoursAgo(20)]
    );
    if (status === 'approved') run(`UPDATE items SET status = 'claimed' WHERE id = ?`, [idCard.id]);
  }

  // A claim that goes to manual review: wrong-ish answer.
  const bottle = get(`SELECT * FROM items WHERE title LIKE 'Green insulated water bottle%'`);
  if (bottle) {
    run(
      `INSERT INTO claims (item_id, claimant_id, verification_answer_submitted, status, created_at) VALUES (?, ?, ?, 'manual_review', ?)`,
      [bottle.id, s1, '[submitted]', hoursAgo(10)]
    );
  }

  // A pending claim, freshly submitted.
  const headphones = get(`SELECT * FROM items WHERE title LIKE 'White wireless headphones%'`);
  if (headphones) {
    run(
      `INSERT INTO claims (item_id, claimant_id, verification_answer_submitted, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
      [headphones.id, s3, '[submitted]', hoursAgo(1)]
    );
  }

  // A rejected claim for audit trail.
  const wallet = get(`SELECT * FROM items WHERE title LIKE 'Brown wallet with cards%'`);
  if (wallet) {
    run(
      `INSERT INTO claims (item_id, claimant_id, verification_answer_submitted, status, created_at, reviewed_at) VALUES (?, ?, ?, 'rejected', ?, ?)`,
      [wallet.id, s2, '[submitted]', hoursAgo(9), hoursAgo(8)]
    );
  }

  // A fifth claim: casio calculator, approved.
  const calc = get(`SELECT * FROM items WHERE title LIKE 'Silver Casio calculator%'`);
  if (calc) {
    const verify = verificationService.verifyAnswer('initials written in marker on the back', calc.verification_answer_hash, null);
    const status = verificationService.decideClaimStatus(verify, true);
    run(
      `INSERT INTO claims (item_id, claimant_id, verification_answer_submitted, status, created_at) VALUES (?, ?, ?, ?, ?)`,
      [calc.id, s1, '[submitted]', status, hoursAgo(70)]
    );
    if (status === 'approved') run(`UPDATE items SET status = 'claimed' WHERE id = ?`, [calc.id]);
  }

  const claimCount = get('SELECT COUNT(*) as n FROM claims').n;
  console.log(`  Created ${claimCount} claims.`);
}

async function main() {
  console.log('Seeding ReFind demo data...');
  console.log('1/4 Clearing existing data...');
  await clearData();

  console.log('2/4 Creating users...');
  const { studentIds, adminId } = await seedUsers();
  console.log(`  Created ${studentIds.length} students + 1 admin.`);

  console.log('3/4 Creating lost & found items...');
  const { lostIds, foundIds } = await seedItems({ studentIds });
  console.log(`  Created ${lostIds.length} lost items and ${foundIds.length} found items.`);

  console.log('4/4 Generating matches and claims...');
  await seedMatches();
  await seedClaims({ studentIds });

  console.log('\nDone! Demo credentials:');
  console.log('  Student : student1@campus.edu / password123');
  console.log('  Student : student2@campus.edu / password123');
  console.log('  Student : student3@campus.edu / password123');
  console.log('  Admin   : admin@campus.edu / admin123');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
