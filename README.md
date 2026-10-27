# Quizzy — Phase 2 (Node.js + Express + MongoDB Atlas + JWT)

Phase 1 (HTML/CSS/vanilla JS, SM-2 spaced repetition) is kept. Phase 2 adds a real backend: accounts, questions, SM-2 progress and attempt history now live in **MongoDB**, and the **server** grades attempts and runs SM-2.

> **Honest test status** — see [Verification](#verification) at the bottom. Short version: SM-2 parity with the original `js/sm2.js` and the frontend flow were tested; the Express+MongoDB code was **not** run against a real database in the environment where it was written (no network). Follow the "first run" checklist and the Postman collection to verify on your machine.

## 1. Prerequisites
- Node.js 18+ (`node -v`), npm
- A free MongoDB Atlas account
- Postman (for API testing)

## 2. Install
```bash
npm install
```

## 3. MongoDB Atlas
1. Atlas → create a free **M0** cluster.
2. **Database Access** → Add a database user (username + password; keep them private).
3. **Network Access** → Add IP address (your current IP; `0.0.0.0/0` only for quick testing).
4. **Connect → Drivers** → copy the `mongodb+srv://...` string. Add a database name, e.g. `.../quizzy?retryWrites=true&w=majority`.
   Atlas clusters are replica sets, so attempt submission uses a real **transaction**.

## 4. `.env`
```bash
cp .env.example .env      # Windows: copy .env.example .env
```
Fill in `MONGODB_URI`, `JWT_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), and the `TEACHER_*` values. `.env` is git-ignored; never commit it.

## 5. Seed the question bank (safe, re-runnable)
```bash
npm run seed
```
Imports the original 108 questions (verbatim from `js/questions.js`, ids like `h1`, `py3` preserved). It only **inserts missing** questions (`$setOnInsert`) — it never overwrites teacher edits and never drops anything.

## 6. Create the first teacher (the only way to get one)
Set `TEACHER_NAME`, `TEACHER_EMAIL`, `TEACHER_PASSWORD` (min 8 chars) in `.env`, then:
```bash
npm run create-teacher
```
Public registration **always** creates a `student`; a `role` sent in the body is ignored. To promote an existing account: `PROMOTE=true npm run create-teacher`. After creating the teacher you can blank out `TEACHER_PASSWORD` in `.env`.

## 7. Start & open the app
```bash
npm start            # or: npm run dev
```
Open **http://localhost:5000** — Express serves the existing frontend and the API from one origin (no CORS setup). Only front-end assets are served (never `.env`, `server/`, `package.json`).

Using VS Code Live Server instead? Add `<script>window.QUIZZY_API_BASE="http://localhost:5000";</script>` before `js/api.js` in your pages (or edit `BASE` in `js/api.js`) and put your Live Server origin in `CORS_ORIGINS`.

## 8. Postman
Import both files from `postman/`:
- `Quizzy-Phase2.postman_collection.json`
- `Quizzy-Local.postman_environment.json` → select **Quizzy Local** (top-right) and set `teacherEmail` / `teacherPassword` to the teacher you created.

Run the folders **in this order** (or Collection Runner → run whole collection):
1. **0. Health**
2. **1. Student workflow** (1.1 → 1.20): register → login → profile → due questions → lock one answer → submit attempt → duplicate submit (409) → due again (wrong answers come back first) → progress → forged-field test → invalid inputs → premium 403 → leaderboard
3. **2. Teacher question CRUD** (2.1 → 2.15): login → create → duplicate → invalid → list → get → 404 → update → invalid update → delete (hard) → delete with history (archived) → restore
4. **3. Authorization checks**: student → teacher routes = **403**; no/garbage token = **401**

Tokens/IDs (`studentToken`, `teacherToken`, `questionId`, `sessionId` …) are extracted automatically by test scripts. No credentials are stored in the collection.

## 9. API reference
All responses: `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details?" } }`. Authenticated routes need `Authorization: Bearer <token>`.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/register` `{name,email,password}` | – | Create **student** → `201 {user}` |
| `POST /api/auth/login` `{email,password}` | – | `200 {token, expiresIn, user}` (students and teachers) |
| `GET /api/auth/me` | any | Safe profile + role |
| `PATCH /api/auth/me` `{name}` | any | Rename (profile page) |
| `GET /api/questions/due?subject=HTML&test=1` | any | **Server applies Phase 1 selection** (due → fresh → rest, 6 questions) from *your* SM-2 state. Returns `{sessionId, questions:[{id,cat,q,options}], selection:{due,fresh,rest}}` — **no answers** |
| `POST /api/questions/answer` `{sessionId,questionId,chosen,timeSec}` | any | Locks one answer (immutable) and reveals `{correct,isCorrect,explain}` — keeps Phase 1's instant feedback without sending answers up front |
| `POST /api/attempts` `{sessionId,subject,testNumber,totalTimeSec?,answers:[{questionId,chosen,timeSec}]}` | any | Server grades, runs SM-2, saves attempt + progress + XP/streak atomically → `201 {attempt, sm2Updates, stats}` |
| `GET /api/attempts`, `GET /api/attempts/:id` | any | Your own attempts only |
| `GET /api/me/data` | any | Your SM-2 state, history, XP, streak, achievements (replaces localStorage) |
| `GET /api/leaderboard` | any | Public fields only (no emails) |
| `GET /api/public/stats` | – | Landing-page counts |
| `POST /api/teacher/questions` `{cat,q,options[4],correct(0-3),explain?,id?}` | **teacher** | Create → `201` |
| `GET /api/teacher/questions?subject=&includeArchived=&page=&limit=` | teacher | List (includes answers) |
| `GET /api/teacher/questions/:id` | teacher | One question |
| `PUT /api/teacher/questions/:id` | teacher | Partial update; id immutable; `{active:true}` restores |
| `DELETE /api/teacher/questions/:id` | teacher | No attempts → deleted. Has history → **archived** (`active:false`), history/SM-2 kept |

Sample — `POST /api/attempts` response (abridged):
```json
{ "success": true, "data": {
  "attempt": { "id": "6650…", "subject": "HTML", "testNumber": 1, "score": 4, "total": 6, "answers": [{ "chosen": 1, "correct": true, "timeSec": 5, "quality": 5 }] },
  "sm2Updates": [{ "questionId": "h1", "quality": 5, "ef": 2.6, "reps": 1, "interval": 1, "nextReview": 1767225600000, "lastResult": "right" }],
  "stats": { "xp": 40, "streak": { "current": 1, "best": 1 }, "achievements": ["first_test"], "newlyUnlocked": ["first_test"] } } }
```

**Error codes:** `400` `VALIDATION_ERROR`, `BAD_JSON`, `SESSION_MISMATCH`, `QUESTION_NOT_IN_SESSION`, `INCOMPLETE_ATTEMPT` · `401` `AUTH_REQUIRED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `BAD_CREDENTIALS` · `403` `FORBIDDEN` (not a teacher), `PREMIUM_REQUIRED` · `404` `NOT_FOUND`, `QUESTION_NOT_FOUND`, `SESSION_NOT_FOUND`, `ATTEMPT_NOT_FOUND` · `409` `EMAIL_TAKEN`, `DUPLICATE_ID`, `DUPLICATE_QUESTION`, `ALREADY_SUBMITTED`, `ANSWER_MISMATCH`, `QUESTION_UNAVAILABLE` · `429` `RATE_LIMITED` · `500` `SERVER_ERROR` (no internals leaked).

## 10. How server-side SM-2 works
- `server/services/sm2.js` is a line-for-line port of `sm2Update`, `shuffle`, `selectQuestionsForSubject` (js/sm2.js) and the quality rule in js/quiz.js (`correct ? (t≤10?5 : t≤20?4 : 3) : (no answer?0:1)`). Constants unchanged: 6 questions, 30 s, `DAY_MS`. Only `now`/RNG are injectable for testing.
- The original `js/sm2.js` is **untouched** (the frontend still uses its `TEST_SIZE`/`Q_SECONDS`), but the browser no longer calls `sm2Update` or saves any SM-2 state.
- Flow: `GET /questions/due` creates a `QuizSession` (which questions were issued to whom) → each answer is locked via `/questions/answer` → `POST /attempts` claims the session atomically, re-derives correctness from the stored question, computes quality, applies `sm2Update` per question, and writes `AttemptLog` + `Progress` (one doc per student×question) + user XP/streak/achievements **in one MongoDB transaction**. A second submit gets `409`. Client-sent `score`, `correct`, `ef`, `reps`, `interval`, `nextReview` are ignored.
- On a standalone (non-replica-set) local MongoDB, transactions are unavailable; the code falls back to an atomic session claim plus a compensating rollback. Use Atlas for full atomicity.
- Collections: `users`, `questions`, `progresses`, `attemptlogs`, `quizsessions` (sessions auto-expire after 2 h). Attempts store a **snapshot** of each question, so editing/archiving a question never rewrites history.

## 11. Frontend integration (what changed)
Same HTML/CSS/layout/navigation. Added `js/api.js` (fetch wrapper, JWT in `sessionStorage`, 401 → login redirect, network-error messages). Rewritten internals, same public method names: `auth.js`, `storage.js`. Edited: `quiz.js` (loads questions from the API; server reveals/grades), `questions.js` (**correct answers no longer ship to the browser** — only the subject list remains; the bank lives in `server/seed/questions.seed.json`), `progress.js` (`dueQuestions`), `dashboard.js`, `profile.js`, `result.js`, `test-selection.js`, `subjects.js`, `index.js`, `leaderboard.js`. The 13 HTML files only gained one `<script src="./js/api.js">` line. Unchanged: `sm2.js`, `styles.css`, `app.js`, `theme.js`, `notifications.js`, `validation.js`, `login.js`, `signup.js`, `career.js`.
Remaining browser storage (non-sensitive only): JWT + display name (`sessionStorage`), theme (`localStorage`), career selection (`sessionStorage`).

## 12. Limitations & migration notes
- **Phase 1 browser data is not migrated** (it was local and password hashes were client-side). Students re-register; SM-2 progress starts fresh.
- Response time (`timeSec`) is measured by the browser (as in Phase 1), validated 0–30 s but cannot be proven by the server; a tampered client could under-report time to earn higher SM-2 quality. Fixing that would require server-timed question flow (a UX change), so it was not done.
- JWT logout is client-side (token discarded; it expires after `JWT_EXPIRES_IN`, default 2 h). Tokens in `sessionStorage` are readable by XSS — the leaderboard now HTML-escapes names for this reason.
- Streak "day" uses the **server's** time zone (set `TZ` if needed). Test 3 stays Premium-gated (no real payments, as in Phase 1). The `top10` achievement was never awardable in Phase 1 and still isn't.
- Teachers can only use the nine existing subjects (the UI's subject list is static). No teacher dashboard (Postman only, as requested).
- Test sequence (Test 2 after Test 1) is enforced by the UI as in Phase 1, not by the API.

## Verification
| Check | Result |
|---|---|
| `npm test` — server SM-2 vs **original `js/sm2.js`** (loaded in a sandbox): 750+ state×quality combinations, selection ordering with identical RNG, quality rule, constants, 108-question seed integrity | **5/5 pass** |
| Frontend end-to-end in headless Chromium against an in-memory mock of this API: signup → login → subjects → quiz (6 answers, reveal) → submit → result → dashboard → profile rename → leaderboard (+XSS escaping) → premium modal → expired token redirect; no bank in the browser; no JS errors | **pass** (mock, not the real server) |
| All server modules load and 19 routes register (third-party deps stubbed) · Postman scripts parse · every Postman path exists in the route table | **pass** |
| Express + Mongoose against a **real MongoDB**, bcrypt/JWT with real libraries, transactions, Postman collection run | **NOT run** — sandbox had no network/npm/MongoDB. Run `npm install`, steps 3–7, then the Postman collection; fix anything it reveals. |
