# Legal Triage Router (AI Challenge)

Rule-based legal triage with optional OpenAI field extraction and copy rewriting. It routes employee requests to the right legal contact and asks for missing context when needed.

## Demo

> ~30 seconds to walk through the full flow: rule configuration → chat-based triage → missing field clarification → successful routing

[![Demo Video](docs/demo-cover.png)](https://youtu.be/HZ48viFuP2Y)

## Features
- `/api/chat` supports multi-turn chats with `conversationId`, using `pendingField` to drive follow-up questions (server/src/application/conversations/chatService.ts)
- `/api/rules` CRUD with validation and JSON persistence (server/src/routes/rules.ts, server/data/rules.json)
- Routing honors `priority`, `enabled`, and returns `matched` / `missing_fields` / `no_match` (server/src/domain/ruleEngine.ts)
- OpenAI optional: field extraction (llmFieldExtractor.ts) and reply rewriting (llmCopywriter.ts); without a key it falls back to templates and continues the flow
- Mobile-oriented chat UI and rules console (client/src/pages/ChatPage.tsx, ConfigurePage.tsx)
- Integration test script covers routing and conversation restore (server/test/run-chat-tests.ts)

More design notes:
- docs/Implementation_V1.0.0.md
- docs/Implementation_V1.1.0.md
- docs/Implementation_V1.2.0.md
- docs/TestCases.md

---

## Quickstart

> Node version is not declared in the repo; use Node 18+/20+ (verify locally).

1) Backend
```bash
cd server
npm install
npm run dev          # defaults to PORT=5000; override via .env
```

2) Frontend (new terminal)
```bash
cd client
npm install
npm run dev          # defaults to http://localhost:5173; calls VITE_API_BASE_URL or falls back to http://localhost:5000
```

URLs:
- API: http://localhost:5000 by default (`/health` for liveness)
- Frontend: http://localhost:5173

Production/build:
- Backend: `npm run start` (build then run dist/index.js)
- Frontend: `npm run build`, `npm run preview`

---

## Environment Variables (.env at repo root)
- `PORT`: backend port, default 5000 (server/src/index.ts, server/src/env.ts)
- `OPENAI_API_KEY`: optional. If missing, startup warns; field extraction returns empty; copy rewriting is skipped; templates still work (index.ts, llmFieldExtractor.ts, llmCopywriter.ts)
- `OPENAI_BASE_URL`: optional, passed to OpenAI SDK (index.ts)
- `OPENAI_MODEL`: optional, default `gpt-4o-mini` (llmFieldExtractor.ts, llmCopywriter.ts)
- `FALLBACK_EMAIL`: optional, default `legal@acme.corp`, used when no rule matches (chatService.ts)
- `VITE_API_BASE_URL`: optional, frontend API base; default `http://localhost:5000` (client/src/api.ts, client/vite.config.ts loads root .env via `envDir: '..'`)
- Test-related: `API_BASE_URL` (default `http://localhost:8999`), `RUN_LLM` (=1 enables OpenAI scenarios), optional `OPENAI_API_KEY` (server/test/run-chat-tests.ts)

---

## Data & Persistence
- Rules: `server/data/rules.json`, loaded at startup and persisted on CRUD (routes/rules.ts)
- Field aliases: `server/data/fieldAliases.json` for contractType/location/department normalization (application/normalizers.ts)
- Conversations: `server/data/conversations/`, each reply writes `<conversationId>.json`; in-memory cache evicts after 30 minutes idle and flushes to disk; sweep runs every 60s (conversationRepository.ts)

---

## API (minimal contract)
- `POST /api/chat`
  - Body: `{ userMessage: string, conversationId?: string }` (non-empty userMessage required)
  - Response: `{ conversationId: string, response: string, quickReplies?: string[] }`
  - Behavior: on match returns assigneeEmail; on missing fields asks up to 2 questions with quickReplies; no match uses `FALLBACK_EMAIL`
- `GET /api/rules` / `POST /api/rules` / `PUT /api/rules/:id` / `DELETE /api/rules/:id`
  - Fields limited to `contractType` | `location` | `department`; operator fixed to `"equals"`; `assigneeEmail` must be a valid email (routes/rules.ts)
  - POST/PUT persist immediately to `server/data/rules.json`
- `GET /api/conversations/:id`: returns `{ conversationId, history: [{ role: 'user'|'assistant', content: string, ts: number }, ...] }`; 404 if not found (routes/conversations.ts)

---

## Tests
- Requirement: backend running; default expects `API_BASE_URL=http://localhost:8999`
- Run:
```bash
cd server
API_BASE_URL=http://localhost:8999 npm test   # if you change the backend port, start it with the same PORT first (e.g., PORT=8999 npm run dev)
# Optional: RUN_LLM=1 to enable OpenAI-dependent scenarios (needs OPENAI_API_KEY)
```
- Coverage: routing decisions, missing-field prompts, conversation restore, rule disable/fallback (server/test/run-chat-tests.ts, docs/TestCases.md)

---

## Design Notes (code-backed)
- `pendingField`: tracks the field to ask next; the next user message is parsed for that field first (chatService.ts, fieldParsers.ts)
- `priority`/`enabled`: rules are filtered by `enabled`, sorted by `priority` desc, and evaluated in that order (ruleEngine.ts)
- `missing_fields`: aggregates missing fields from partial matches; `selectNextField` chooses by distinctness and default order (contractType→location→department) (ruleEngine.ts, nextQuestionSelector.ts)
- Replies: `composePlan` builds templates; `rewriteWithLLM` only runs with an OpenAI key and must not change routing; without a key, templates and quickReplies are returned (responseComposer.ts, llmCopywriter.ts)

---

## Future Work
- Add rule change audit/versioning to trace routing decisions
- Add cleanup/archival strategy for `server/data/conversations` to prevent unbounded growth
- Add rule import/export and easier environment switching (local/test) in the frontend
