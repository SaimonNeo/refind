# ReFind — Campus Lost & Found

A campus lost & found platform that pairs a transparent, deterministic
scoring engine with optional AI semantic comparison to connect lost item
reports with found item reports — without making the whole system dependent
on an AI API.

## Tech stack

- **Backend:** Node.js + Express
- **Database:** SQLite via Node's built-in `node:sqlite` module (no native build step required — just `npm install` and go)
- **Frontend:** HTML5 + CSS3 + vanilla JavaScript (no framework, no build step)
- **Auth:** JWT (`jsonwebtoken`) + `bcryptjs` password hashing
- **Uploads:** Multer (item photos and claim ID proofs)
- **Charts:** Chart.js (loaded via CDN on the analytics page)
- **AI:** Google Gemini, called server-side only, with a graceful deterministic fallback when unconfigured or unavailable

## Getting started

```bash
npm install
npm run seed            # optional but strongly recommended — loads demo data
npm start
```

Then open **http://localhost:3000**.

### Environment variables (`.env`)

| Variable | Purpose | Required |
|---|---|---|
| `PORT` | Server port | No (defaults to 3000) |
| `JWT_SECRET` | Signing secret for auth tokens | Recommended to change before sharing this build |
| `AI_PROVIDER` | Currently only `gemini` is implemented | No |
| `AI_MODEL` | Gemini model name | No (defaults to `gemini-flash-latest`, an alias Google keeps pointed at their current stable Flash model) |
| `GEMINI_API_KEY` | Your Gemini API key | No — **if omitted, AI scoring is skipped and the deterministic engine still works end to end** |

The AI key never reaches the browser — it's read from `.env` inside `services/aiService.js` and used only in server-side `fetch` calls.

## Demo credentials (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Student | student1@campus.edu | password123 |
| Student | student2@campus.edu | password123 |
| Student | student3@campus.edu | password123 |
| Admin | admin@campus.edu | admin123 |

## Project structure

```
refind/
├── server.js                 Express app entry point
├── database/
│   ├── schema.sql             Table definitions
│   ├── database.js            node:sqlite connection + query helpers
│   └── seed.js                Demo data generator (npm run seed)
├── middleware/
│   └── auth.js                JWT auth, suspension check, admin-role guard
├── routes/
│   ├── auth.js                register / login / me / profile edit / password change
│   ├── items.js                CRUD, edit, withdraw, browse/search/sort, image upload
│   ├── matches.js              fetch stored matches for an item
│   ├── claims.js               submit + review ownership claims, ID proof upload, handover confirm
│   ├── admin.js                dashboard, users, claims review, audit log, recovered register, analytics
│   └── notifications.js        in-app notification center
├── services/
│   ├── matchingEngine.js       the hybrid scoring algorithm + duplicate detection
│   ├── aiService.js            Gemini wrapper with strict-JSON prompting + fallback
│   ├── verificationService.js  private-answer hashing + claim decisioning
│   ├── notificationService.js  in-app notifications
│   └── auditService.js         audit trail for admin/security actions
├── uploads/                    uploaded item photos and claim ID proofs
└── public/                     the frontend (no build step)
```

## The matching engine

Every LOST item is compared against every active FOUND item on a 100-point
scale:

| Signal | Points | Basis |
|---|---|---|
| Category | 25 | Exact match, or partial credit for related categories |
| Color | 15 | Exact match, or partial credit for the same color family |
| Location | 20 | Exact match, or partial credit for adjacent campus buildings |
| Time | 15 | Decays with the gap between the lost and found timestamps |
| AI similarity | 25 | Gemini's semantic read of the two free-text descriptions, converted from a 0–100 similarity score |

**The AI is one input among five, not the whole system.** If `GEMINI_API_KEY`
is unset, or the Gemini call times out or errors, `aiService.compareItems()`
returns a safe fallback (`similarity: 0, confidence: 'low'`) and the other 75
points still work normally.

Matches are generated automatically in the background whenever a new item is
reported, and stored (not recomputed on every page view). New matches above
55% trigger an in-app notification to both reporters.

A lightweight duplicate-report check also runs on submission: if the same
person has filed a very similar report (same type, category, location, and
overlapping title words) in the last 48 hours, they get a non-blocking
heads-up rather than a second identical entry.

## Ownership verification and claims

When someone reports a **found** item, they can attach a private verification
question/answer. That answer is stored as a SHA-256 hash and is **never**
returned by any public item API — only the question text is exposed, and only
after a logged-in user explicitly requests it to start a claim.

A claimant can also leave a phone number and upload an ID proof (photo or
PDF) to speed up manual review — both are visible only to the item's finder
and to admins.

Claim outcomes:
- **approved** — exact hash match
- **manual_review** — a close-but-not-exact answer, an uploaded ID proof with
  no exact match, or no verification was configured at all
- **rejected** — an admin-driven rejection after review

Once an admin (or the automatic exact-match path) approves a claim, they can
attach a handover location, date/time, and collection instructions. The
claimant sees these on their dashboard and confirms receipt once they've
actually picked the item up, which marks the report `resolved` and completes
the audit trail.

## Admin tools

- **Overview** — totals, pending claims, high-priority matches
- **Items** — every report, with a way to remove fraudulent or inappropriate ones
- **Claims** — approve (with handover details) or reject anything in manual review, with confidence score, phone, and ID proof visible
- **Recovered** — a register of everything claimed or resolved
- **Users** — suspend or unsuspend accounts (suspension takes effect immediately, even on an existing session)
- **Audit log** — a trace of account and report actions
- **Analytics** — lost vs. found, recovery rate, category/location breakdowns

## In-app notifications

A notification bell in the nav (once logged in) surfaces: new potential
matches, claim status changes, admin decisions on claims, and recovery
confirmations. No email or SMS delivery — everything lives in-app.

## Known limitations

- The AI similarity check is intentionally one signal among five — see "The
  matching engine" above for what happens if it's unavailable.
- Matching is O(active items) per new report; fine for a campus-scale
  dataset, would need a proper index/ANN approach at real scale.
- `node:sqlite` is an experimental Node API (stable enough for this build on
  Node 22+, but flagged as experimental by Node itself).
- No email/SMS notifications — everything surfaces in the in-app notification center only.
- The soft-match fallback in claim verification is intentionally lenient to
  avoid punishing an honest owner who slightly misremembers wording; it routes
  to `manual_review` rather than auto-approving, so a human still checks it.

## Commands

```bash
npm install    # install dependencies
npm run seed   # reset the DB and load demo data
npm start       # run the server
npm run dev     # run with --watch for local development
```

