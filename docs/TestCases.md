# Chat Routing E2E Tests

API-level E2E tests for chat routing. Runs against a live backend (no frontend required).
Source: `server/test/run-chat-tests.ts`

## Run

Default test target (runner `BASE_URL`): `http://localhost:8999`. The server defaults to port 5000, so either start it on 8999 or override the base URL.

Start server on 8999 (from repo root):

```bash
cd server
PORT=8999 npm run dev
```

Run tests (from `server/`):

```bash
npm run test
```

Override API base URL (if your server is not on 8999):

```bash
API_BASE_URL=http://localhost:5000 npm run test
```

LLM field extraction is required for the single-turn scenarios to pass; set `OPENAI_API_KEY` before running.

Optional LLM extraction scenario (auto-enabled when `OPENAI_API_KEY` is set; or force with `RUN_LLM=1`):

```bash
RUN_LLM=1 OPENAI_API_KEY=xxx npm run test
```

## What it tests

### Rule seeding (create-if-missing)

The runner ensures these rules exist by **name** (it does not modify existing rules):

* AU Sales -> John (p10): Sales + Australia -> `john@acme.com`
* US Employment -> Alice (p10): Employment + United States -> `alice@acme.com`
* UK NDA -> Bob (p9): NDA + United Kingdom -> `bob@acme.com`
* AU Marketing -> Chloe (p8): Marketing + Australia -> `chloe@acme.com`
* Global HR -> Dana (p6): HR -> `dana@acme.com`
* Global Sales (low) -> Eve (p1): Sales -> `eve@acme.com`

### Scenarios

Each scenario sends messages to `POST /api/chat` (multi-turn reuses the same `conversationId`) and asserts the **final response contains** the expected email:

1. AU Sales full match

   * `I have a Sales contract in Australia`
   * expects `john@acme.com`

2. Missing fields multi-turn: Employment US

   * `Need a contract reviewed` -> `Employment` -> `United States`
   * expects `alice@acme.com`

3. Alias: Sales + Sydney

   * `commercial deal from Sydney` -> `Sales` -> `Australia`
   * expects `john@acme.com`

4. Department rule: Marketing AU

   * `Marketing campaign approval, I'm in Melbourne` -> `Marketing` -> `Australia`
   * expects `chloe@acme.com`

5. Department only: HR

   * `HR policy question about probation` -> `HR`
   * expects `dana@acme.com`

6. Low-priority Sales fallback

   * `Sales contract in Brazil`
   * expects `eve@acme.com`

7. No match fallback

   * `Travel reimbursement for Canada`
   * expects `legal@acme.corp`

### Conversation restore

After scenarios, runner calls `GET /api/conversations/:id` using a previous `conversationId` and checks:

* `history` is an array
* `history.length >= 2`

### Rule disable fallback

Runner disables `AU Sales -> John`, then sends:

* `Sales contract in Australia`
* expects fallback to `eve@acme.com`
  Then re-enables the rule (best effort).

### Optional: LLM extraction scenario

Runs when `RUN_LLM=1` **or** an API key is present (auto-enabled with `OPENAI_API_KEY`):

* `I'm hiring a backend engineer` -> `Based in NYC`
* expects `alice@acme.com`

## Pass/Fail

* A scenario passes if the final assistant response contains the expected email (case-insensitive).
* The test run exits with code 1 if any scenario fails.
