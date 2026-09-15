// services/matchingEngine.js
//
// ReFind's hybrid matching engine.
//
// Deterministic rules handle structured attributes (category, color,
// location, time). AI handles semantic understanding of the free-text
// description. The AI contributes ONLY to its own 25-point slice, so the
// system stays explainable and keeps working even if the AI is unavailable.
//
//   Category        25 pts
//   Color           15 pts
//   Location        20 pts
//   Time            15 pts
//   AI similarity   25 pts
//   --------------------
//   Total          100 pts

const { all, get, run } = require('../database/database');
const aiService = require('./aiService');
const notificationService = require('./notificationService');

const WEIGHTS = {
  category: 25,
  color: 15,
  location: 20,
  time: 15,
  ai: 25,
};

// Related-category pairs score partial credit instead of zero.
const RELATED_CATEGORIES = {
  electronics: ['accessories'],
  bags: ['accessories'],
  accessories: ['electronics', 'bags', 'jewelry'],
  jewelry: ['accessories'],
  documents: ['cards'],
  cards: ['documents'],
  clothing: ['accessories'],
};

// Loose color-family grouping for partial credit.
const COLOR_FAMILIES = [
  ['black', 'dark', 'charcoal', 'navy'],
  ['white', 'cream', 'ivory'],
  ['gray', 'grey', 'silver'],
  ['red', 'maroon', 'crimson'],
  ['blue', 'teal', 'cyan'],
  ['green', 'olive'],
  ['brown', 'tan', 'beige', 'khaki'],
  ['yellow', 'gold'],
  ['pink', 'magenta'],
  ['orange'],
  ['purple', 'violet'],
];

// Campus locations grouped by proximity so "nearby" still earns partial credit.
const LOCATION_PROXIMITY = {
  'central library': ['academic building', 'computer science building'],
  'computer science building': ['central library', 'laboratory', 'academic building'],
  cafeteria: ['student center', 'main gate'],
  auditorium: ['academic building', 'student center'],
  'main gate': ['cafeteria', 'student center'],
  'academic building': ['central library', 'computer science building', 'auditorium'],
  laboratory: ['computer science building', 'academic building'],
  'student center': ['cafeteria', 'main gate', 'auditorium'],
};

function normalize(str) {
  return (str || '').toString().trim().toLowerCase();
}

function scoreCategory(lostCategory, foundCategory) {
  const a = normalize(lostCategory);
  const b = normalize(foundCategory);
  if (!a || !b) return { score: 0, detail: 'category unknown' };
  if (a === b) return { score: WEIGHTS.category, detail: `both categorized as "${a}"` };
  const related = RELATED_CATEGORIES[a] || [];
  if (related.includes(b)) {
    return { score: Math.round(WEIGHTS.category * 0.4), detail: `related categories ("${a}" / "${b}")` };
  }
  return { score: 0, detail: 'different categories' };
}

function scoreColor(lostColor, foundColor) {
  const a = normalize(lostColor);
  const b = normalize(foundColor);
  if (!a || !b) return { score: 0, detail: 'color not specified' };
  if (a === b || a.includes(b) || b.includes(a)) {
    return { score: WEIGHTS.color, detail: `matching color ("${a}")` };
  }
  const family = COLOR_FAMILIES.find((f) => f.some((c) => a.includes(c)));
  if (family && family.some((c) => b.includes(c))) {
    return { score: Math.round(WEIGHTS.color * 0.5), detail: `similar color family ("${a}" / "${b}")` };
  }
  return { score: 0, detail: 'different colors' };
}

function scoreLocation(lostLocation, foundLocation) {
  const a = normalize(lostLocation);
  const b = normalize(foundLocation);
  if (!a || !b) return { score: 0, detail: 'location not specified' };
  if (a === b) return { score: WEIGHTS.location, detail: `same location ("${a}")` };
  const nearby = LOCATION_PROXIMITY[a] || [];
  if (nearby.includes(b)) {
    return { score: Math.round(WEIGHTS.location * 0.6), detail: `nearby locations ("${a}" and "${b}")` };
  }
  return { score: Math.round(WEIGHTS.location * 0.1), detail: 'different, non-adjacent locations' };
}

function scoreTime(lostDate, foundDate) {
  if (!lostDate || !foundDate) return { score: Math.round(WEIGHTS.time * 0.3), detail: 'date not fully specified' };
  const a = new Date(lostDate).getTime();
  const b = new Date(foundDate).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { score: Math.round(WEIGHTS.time * 0.3), detail: 'date not fully specified' };
  }
  const diffHours = Math.abs(a - b) / 36e5;
  if (diffHours <= 6) return { score: WEIGHTS.time, detail: 'reported within hours of each other' };
  if (diffHours <= 24) return { score: Math.round(WEIGHTS.time * 0.8), detail: 'reported the same day' };
  if (diffHours <= 72) return { score: Math.round(WEIGHTS.time * 0.5), detail: 'reported within a few days' };
  if (diffHours <= 168) return { score: Math.round(WEIGHTS.time * 0.25), detail: 'reported within a week' };
  return { score: 0, detail: 'reported far apart in time' };
}

/**
 * Convert an AI similarity value (0-100) into the 25-point weighted score.
 */
function aiScoreFromSimilarity(similarity) {
  const clamped = Math.max(0, Math.min(100, Number(similarity) || 0));
  return Math.round((clamped / 100) * WEIGHTS.ai);
}

function buildExplanation({ categoryDetail, colorDetail, locationDetail, timeDetail, aiFeatures, total }) {
  const positives = [];
  if (categoryDetail) positives.push(categoryDetail);
  if (colorDetail) positives.push(colorDetail);
  if (locationDetail) positives.push(locationDetail);
  if (timeDetail) positives.push(timeDetail);

  let summary;
  if (total >= 85) summary = 'Strong match';
  else if (total >= 60) summary = 'Likely match';
  else if (total >= 35) summary = 'Possible match';
  else summary = 'Weak match';

  let sentence = `${summary} — ${positives.join(', ')}.`;
  if (aiFeatures && aiFeatures.length) {
    sentence += ` AI also found: ${aiFeatures.join(', ')}.`;
  }
  return sentence;
}

/**
 * Compute the full match score between a lost item and a found item.
 * Never throws — if the AI call fails, aiService already returns a
 * graceful fallback (similarity 0, confidence 'low').
 */
async function computeMatch(lostItem, foundItem) {
  const category = scoreCategory(lostItem.category, foundItem.category);
  const color = scoreColor(lostItem.color, foundItem.color);
  const location = scoreLocation(lostItem.location, foundItem.location);
  const time = scoreTime(lostItem.event_date, foundItem.event_date);

  // Optimization: Only run expensive AI comparison on items that share the same category
  // (or 'other', or closely related cards/documents) to save API quota and avoid comparing
  // completely different objects (e.g. comparing an umbrella to a laptop).
  const isCompatible =
    lostItem.category === foundItem.category ||
    lostItem.category === 'other' ||
    foundItem.category === 'other' ||
    (lostItem.category === 'cards' && foundItem.category === 'documents') ||
    (lostItem.category === 'documents' && foundItem.category === 'cards');

  let ai;
  if (!isCompatible) {
    ai = {
      similarity: 0,
      confidence: 'low',
      matchingFeatures: [],
      reason: 'Incompatible categories; AI comparison skipped.',
      usedFallback: false,
    };
  } else {
    try {
      ai = await aiService.compareItems(
        { title: lostItem.title, description: lostItem.description },
        { title: foundItem.title, description: foundItem.description }
      );
    } catch (err) {
      // Defensive: aiService already catches internally, but never let a
      // matching run fail because AI is down.
      ai = { similarity: 0, confidence: 'low', matchingFeatures: [], reason: 'AI unavailable', usedFallback: true };
    }
  }

  const aiPoints = aiScoreFromSimilarity(ai.similarity);
  const total = category.score + color.score + location.score + time.score + aiPoints;

  const explanation = buildExplanation({
    categoryDetail: category.detail,
    colorDetail: color.detail,
    locationDetail: location.detail,
    timeDetail: time.detail,
    aiFeatures: ai.matchingFeatures,
    total,
  });

  return {
    totalScore: total,
    categoryScore: category.score,
    colorScore: color.score,
    locationScore: location.score,
    timeScore: time.score,
    aiScore: aiPoints,
    explanation,
    matchingFeatures: ai.matchingFeatures || [],
    aiConfidence: ai.confidence || 'low',
    aiUsedFallback: !!ai.usedFallback,
  };
}

/**
 * Find and persist matches for a given lost item against all active
 * found items (or vice versa). Only stores matches above MIN_SCORE.
 */
const MIN_SCORE_TO_STORE = 20;

async function generateMatchesForItem(item) {
  if (item.type === 'lost') {
    const candidates = all(
      `SELECT * FROM items WHERE type = 'found' AND status = 'active'`
    );
    for (const found of candidates) {
      await scoreAndStore(item, found);
    }
  } else {
    const candidates = all(
      `SELECT * FROM items WHERE type = 'lost' AND status = 'active'`
    );
    for (const lost of candidates) {
      await scoreAndStore(lost, item);
    }
  }
}

async function scoreAndStore(lostItem, foundItem) {
  const result = await computeMatch(lostItem, foundItem);
  if (result.totalScore < MIN_SCORE_TO_STORE) return null;

  const existing = get(
    `SELECT id FROM matches WHERE lost_item_id = ? AND found_item_id = ?`,
    [lostItem.id, foundItem.id]
  );

  if (existing) {
    run(
      `UPDATE matches SET score=?, category_score=?, color_score=?, location_score=?, time_score=?, ai_score=?, explanation=?, matching_features=? WHERE id=?`,
      [
        result.totalScore,
        result.categoryScore,
        result.colorScore,
        result.locationScore,
        result.timeScore,
        result.aiScore,
        result.explanation,
        JSON.stringify(result.matchingFeatures),
        existing.id,
      ]
    );
    return existing.id;
  }

  const { lastInsertRowid } = run(
    `INSERT INTO matches (lost_item_id, found_item_id, score, category_score, color_score, location_score, time_score, ai_score, explanation, matching_features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lostItem.id,
      foundItem.id,
      result.totalScore,
      result.categoryScore,
      result.colorScore,
      result.locationScore,
      result.timeScore,
      result.aiScore,
      result.explanation,
      JSON.stringify(result.matchingFeatures),
    ]
  );

  // Notify both reporters when a genuinely useful new match shows up —
  // no point pinging people over a 21% overlap.
  if (result.totalScore >= 55) {
    notificationService.notify(
      lostItem.user_id,
      'match',
      `A ${result.totalScore}% potential match was found for your lost report "${lostItem.title}".`,
      `/matches.html?lostItemId=${lostItem.id}`
    );
    notificationService.notify(
      foundItem.user_id,
      'match',
      `A ${result.totalScore}% potential match was found for the item you reported found: "${foundItem.title}".`,
      `/matches.html?foundItemId=${foundItem.id}`
    );
  }

  return lastInsertRowid;
}

/**
 * Get stored matches for a lost item, best first, joined with found item data.
 */
function getMatchesForLostItem(lostItemId) {
  const rows = all(
    `SELECT m.*, i.title as found_title, i.category as found_category, i.color as found_color,
            i.location as found_location, i.image as found_image, i.status as found_status
     FROM matches m
     JOIN items i ON i.id = m.found_item_id
     WHERE m.lost_item_id = ?
     ORDER BY m.score DESC`,
    [lostItemId]
  );
  return rows.map(formatMatchRow);
}

function getMatchesForFoundItem(foundItemId) {
  const rows = all(
    `SELECT m.*, i.title as lost_title, i.category as lost_category, i.color as lost_color,
            i.location as lost_location, i.image as lost_image, i.status as lost_status
     FROM matches m
     JOIN items i ON i.id = m.lost_item_id
     WHERE m.found_item_id = ?
     ORDER BY m.score DESC`,
    [foundItemId]
  );
  return rows.map(formatMatchRow);
}

function getMatchById(matchId) {
  const row = get(`SELECT * FROM matches WHERE id = ?`, [matchId]);
  return row ? formatMatchRow(row) : null;
}

function formatMatchRow(row) {
  return {
    ...row,
    matching_features: row.matching_features ? JSON.parse(row.matching_features) : [],
  };
}

/**
 * Simple duplicate-report heuristic: same reporter, same item type, same
 * category and location, filed within the last 48 hours, with meaningful
 * title word overlap. This is a nudge shown to the reporter, not a hard
 * block — people are allowed to file two genuinely different reports.
 */
function findLikelyDuplicates(userId, type, category, location, title) {
  const candidates = all(
    `SELECT * FROM items
     WHERE user_id = ? AND type = ? AND category = ? AND location = ?
       AND status != 'withdrawn'
       AND created_at >= datetime('now', '-48 hours')
     ORDER BY created_at DESC LIMIT 10`,
    [userId, type, category, location]
  );
  if (!candidates.length) return [];

  const titleWords = new Set(normalize(title).split(/\s+/).filter((w) => w.length > 2));
  return candidates.filter((c) => {
    const otherWords = normalize(c.title).split(/\s+/).filter((w) => w.length > 2);
    const overlap = otherWords.filter((w) => titleWords.has(w)).length;
    return overlap >= Math.min(2, titleWords.size);
  });
}

module.exports = {
  computeMatch,
  generateMatchesForItem,
  getMatchesForLostItem,
  getMatchesForFoundItem,
  getMatchById,
  findLikelyDuplicates,
  WEIGHTS,
};
