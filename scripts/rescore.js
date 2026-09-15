require('dotenv').config();
const { all } = require('../database/database');
const matchingEngine = require('../services/matchingEngine');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function rescore() {
  console.log('--- Starting ReFind Match Rescoring with Gemini ---');
  console.log('AI Provider:', process.env.AI_PROVIDER);
  console.log('AI Model:', process.env.AI_MODEL);

  const lostItems = all(`SELECT * FROM items WHERE type = 'lost' AND status = 'active'`);
  console.log(`Found ${lostItems.length} active lost items to score.`);

  for (const lost of lostItems) {
    console.log(`\nProcessing lost item #${lost.id}: "${lost.title}" (${lost.category})`);
    await matchingEngine.generateMatchesForItem(lost);
  }

  console.log('\n--- Top Matches with AI Scores ---');
  const matches = all(`
    SELECT m.id, m.score, m.ai_score, m.explanation, m.matching_features,
           l.title as lost_title, f.title as found_title
    FROM matches m
    JOIN items l ON l.id = m.lost_item_id
    JOIN items f ON f.id = m.found_item_id
    WHERE m.ai_score > 0
    ORDER BY m.score DESC
    LIMIT 10
  `);

  if (matches.length === 0) {
    console.log('No matches with ai_score > 0 found yet.');
  } else {
    for (const m of matches) {
      console.log(`\nMatch #${m.id} | Total Score: ${m.score} | AI Score: ${m.ai_score}/25`);
      console.log(`  Lost:  ${m.lost_title}`);
      console.log(`  Found: ${m.found_title}`);
      console.log(`  AI Features:`, m.matching_features);
      console.log(`  Explanation:`, m.explanation);
    }
  }

  console.log('\nRescoring complete!');
}

rescore().catch(console.error);
