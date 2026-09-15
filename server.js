// server.js
// ReFind — AI-Assisted Campus Lost & Found
//
// Architecture:
//   Browser (HTML/CSS/Vanilla JS)
//     -> Express REST API (routes/*)
//       -> services (matchingEngine, aiService, verificationService)
//         -> SQLite (database/database.js, via node:sqlite)

require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const matchRoutes = require('./routes/matches');
const claimRoutes = require('./routes/claims');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/health/ai', async (req, res) => {
  const aiService = require('./services/aiService');
  const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '(none)';
  try {
    const testResult = await aiService.compareItems(
      { title: 'Lenovo Tab 3', description: 'Tab with a black Key Chain' },
      { title: 'Lenovo Tab 3', description: 'Have A keychain' }
    );
    res.json({
      status: testResult.usedFallback ? 'fallback' : 'ok',
      apiKeyConfigured: !!apiKey,
      apiKeyMasked: maskedKey,
      modelUsed: process.env.AI_MODEL || 'gemini-3.5-flash-lite',
      testResult,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message, apiKeyConfigured: !!apiKey, apiKeyMasked: maskedKey });
  }
});

// Fallback to index.html for unknown non-API GET requests (simple SPA-ish nav)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handling (e.g. multer errors)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large.' });
  }
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`ReFind server running at http://localhost:${PORT}`);
  console.log(`AI provider: ${process.env.AI_PROVIDER || 'gemini'} (${process.env.GEMINI_API_KEY ? 'configured' : 'NOT configured — using deterministic fallback'})`);
});

module.exports = app;
