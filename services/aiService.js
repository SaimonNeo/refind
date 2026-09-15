// services/aiService.js
//
// Wraps the AI provider used for semantic comparison of item descriptions.
// The rest of the app only calls compareItems() and never needs to know
// which provider is behind it — swap providers by changing AI_PROVIDER /
// AI_MODEL in .env without touching matchingEngine.js.
//
// IMPORTANT: the API key stays server-side. It is read from process.env
// and never sent to the browser.

const MAX_DESCRIPTION_LENGTH = 800;
const REQUEST_TIMEOUT_MS = 18000;

const AI_PROVIDER = () => (process.env.AI_PROVIDER || 'gemini').trim().replace(/^["']|["']$/g, '');
const AI_MODEL = () => {
  const model = (process.env.AI_MODEL || '').trim().replace(/^["']|["']$/g, '');
  if (!model || model.includes('1.5') || model.includes('2.0') || model.includes('2.5') || model === 'gemini-flash-latest' || model === 'gemini-3.8-flash') {
    return 'gemini-3.5-flash-lite';
  }
  return model;
};
const GEMINI_API_KEY = () => {
  const raw = process.env.GEMINI_API_KEY || '';
  return raw.trim().replace(/^["']|["']$/g, '');
};

function sanitize(text) {
  if (!text) return '';
  return String(text).replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_DESCRIPTION_LENGTH);
}

function fallbackResponse(reason) {
  return {
    similarity: 0,
    confidence: 'low',
    matchingFeatures: [],
    reason: reason || 'AI comparison unavailable; deterministic score used instead.',
    usedFallback: true,
  };
}

function buildPrompt(lostItem, foundItem) {
  return `You compare a LOST item report with a FOUND item report from a university campus lost-and-found system and judge whether they might describe the same physical object.

Respond with STRICT JSON ONLY. No markdown, no code fences, no preamble, no explanation outside the JSON object. The JSON must have exactly this shape:
{
  "similarity": <integer 0-100>,
  "confidence": "low" | "medium" | "high",
  "matchingFeatures": [<short strings describing concrete overlapping features actually present in both texts>],
  "reason": "<one sentence>"
}

Rules:
- Only list a matchingFeature if it is genuinely supported by both descriptions. Do not invent details.
- If the two descriptions clearly describe different object types, similarity should be low (below 20).
- Consider brand names, materials, colors, distinguishing marks, and what the item is.

LOST ITEM:
Title: ${sanitize(lostItem.title)}
Description: ${sanitize(lostItem.description)}

FOUND ITEM:
Title: ${sanitize(foundItem.title)}
Description: ${sanitize(foundItem.description)}`;
}

function extractJson(text) {
  if (!text) return null;
  // Strip markdown code fences if the model added them despite instructions.
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function validateResult(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const similarity = Math.max(0, Math.min(100, Math.round(Number(parsed.similarity))));
  if (Number.isNaN(similarity)) return null;
  const confidence = ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low';
  const matchingFeatures = Array.isArray(parsed.matchingFeatures)
    ? parsed.matchingFeatures.filter((f) => typeof f === 'string').slice(0, 8)
    : [];
  const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '';
  return { similarity, confidence, matchingFeatures, reason, usedFallback: false };
}

let lastCallPromise = Promise.resolve();
const MIN_CALL_INTERVAL_MS = 4200;

function paceRequest() {
  const current = lastCallPromise;
  lastCallPromise = current.then(() => new Promise((r) => setTimeout(r, MIN_CALL_INTERVAL_MS)));
  return current;
}

async function callGemini(prompt, retries = 1) {
  await paceRequest();

  const model = AI_MODEL();
  const apiKey = GEMINI_API_KEY();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };
    if (model.includes('3.6') || model.includes('3.7')) {
      payload.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errDetail = '';
      try {
        const errJson = await res.json();
        errDetail = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        errDetail = await res.text().catch(() => '');
      }

      // If rate-limited or transient 503, wait briefly and retry once
      if (retries > 0 && (res.status === 429 || res.status === 503)) {
        console.warn(`[aiService] Received HTTP ${res.status}, waiting 4s before retry...`);
        clearTimeout(timeout);
        await new Promise((r) => setTimeout(r, 4000));
        return callGemini(prompt, retries - 1);
      }

      throw new Error(`Gemini API error ${res.status}: ${errDetail}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Compare a lost item and a found item for semantic similarity.
 * Never throws — always resolves to a valid result object, falling back
 * gracefully when the AI provider is unavailable, unconfigured, or errors.
 */
const semanticCache = new Map();

function getCacheKey(lostItem, foundItem) {
  return `${(lostItem.title || '').trim()}||${(lostItem.description || '').trim()}###${(foundItem.title || '').trim()}||${(foundItem.description || '').trim()}`;
}

async function compareItems(lostItem, foundItem) {
  const apiKey = GEMINI_API_KEY();
  const provider = AI_PROVIDER();

  if (!apiKey) {
    return fallbackResponse('AI_UNCONFIGURED: no GEMINI_API_KEY set in .env');
  }

  if (provider !== 'gemini') {
    return fallbackResponse(`AI_UNSUPPORTED_PROVIDER: "${provider}"`);
  }

  const cacheKey = getCacheKey(lostItem, foundItem);
  if (semanticCache.has(cacheKey)) {
    return semanticCache.get(cacheKey);
  }

  const prompt = buildPrompt(lostItem, foundItem);

  try {
    const raw = await callGemini(prompt);
    const parsed = extractJson(raw);
    const validated = validateResult(parsed);
    if (!validated) {
      console.warn('[aiService] Could not parse valid JSON from AI response:', raw);
      return fallbackResponse('AI_INVALID_RESPONSE: could not parse a valid JSON result');
    }
    console.log(`[aiService] Match scored: "${lostItem.title}" <-> "${foundItem.title}" => ${validated.similarity}% similarity`);
    semanticCache.set(cacheKey, validated);
    return validated;
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'AI_TIMEOUT' : `AI_ERROR: ${err.message}`;
    console.warn(`[aiService] Semantic comparison fallback: ${reason}`);
    return fallbackResponse(reason);
  }
}

module.exports = { compareItems, MAX_DESCRIPTION_LENGTH };
