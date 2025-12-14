# Implementation Overview

This document provides a high-level overview of the current **v1 backend implementation**, helping future iterations quickly locate entry points and understand key logic.

## Architecture Layers

* **`server/src/index.ts`**
  Express bootstrap entry point. Loads configuration and middleware, and wires dependencies (OpenAI client, rule repository, conversation repository, LLM field extractor, router).

* **`routes/`**
  HTTP routing layer.

  * `rules.ts`: Rule CRUD APIs
  * `conversations.ts`: Conversation history queries

* **`application/`**
  Use-case layer.

  * `chatService`: Orchestrates the chat workflow
  * `conversationRepository`: Manages conversation persistence
  * `ruleRouter`: Matches conversation state against rules
  * `llmFieldExtractor`: Uses LLM to assist with field extraction

* **`domain/`**
  Core domain models and pure business logic.

  * `ruleEngine`: Evaluates rules and infers missing fields
  * `conversation`: Manages conversation state and history
  * `rules`: Defines field and condition types

---

## `/api/chat` Request Flow

1. **Entry**
   `server/src/index.ts` receives
   `ChatRequestDTO { conversationId?, userMessage }`
   and validates that `userMessage` is not empty.

2. **Conversation Loading**
   `conversationRepository` first checks the in-memory cache, then attempts to load
   `data/conversations/{id}.json`.
   If not found, a new conversation is created.

3. **Record User Message**
   The user message is appended to the conversation history and `lastActiveAt` is updated.

4. **Field Filling**

   * If a `pendingField` exists, attempt deterministic parsing via
     `parseAnswerForField` (regex / simple rules).
   * If parsing fails, call
     `llmFieldExtractor.extractWithLLM` (default model: `gpt-4o-mini`, JSON output)
     to extract `contractType`, `location`, and `department`.
     If `OPENAI_API_KEY` is missing, this step is skipped.

5. **Rule Evaluation**
   `ruleRouter` loads rules via `getRules()` (memory + disk sync) and calls
   `ruleEngine.evaluateRules`:

   * **`matched`**: return the configured `assigneeEmail`
   * **`missing_fields`**: select the next field in default order
     `['contractType', 'location', 'department']` and respond with a follow-up question
   * **`no_match` / `no_rules`**: return fallback `legal@acme.corp`

6. **Persist Conversation**
   Conversation is written to `data/conversations/{id}.json` (while keeping memory cache).
   Persistence failures are logged but do not block the response.

7. **Response**
   Returns
   `ChatResponseDTO { conversationId, response }`.

---

## Rule Management API (`/api/rules`)

* **`GET /`**
  Returns the current rule list (from in-memory cache).

* **`POST /`**
  Creates a new rule.
  Required fields: `name`, `conditions[]`, `assigneeEmail`
  Optional: `enabled`, `priority`

* **`PUT /:id`**
  Partial update with validation:

  * Fields limited to `contractType | location | department`
  * Operator limited to `equals`
  * Email format validation

* **`DELETE /:id`**
  Deletes a rule.

Rule data is persisted in `server/data/rules.json`.
Rules are loaded into memory on startup and written back to disk after each mutation.

---

## Conversation Storage & Expiry

* **Dual storage**: in-memory cache + disk persistence
  Each conversation is serialized to
  `server/data/conversations/{conversationId}.json`.

* **Expiry policy**

  * `EXPIRY_MS = 30 minutes`
  * `setInterval` runs `sweepExpired()` every minute
  * Expired conversations are flushed to disk and evicted from memory

* **History format**

  ```ts
  {
    role: 'user' | 'assistant',
    content: string,
    ts: number
  }
  ```

  This enables full conversation restoration on the frontend.

---

## Field Parsing Strategy

* **Deterministic parsing (preferred)**

  * `contractType`: keyword matching (NDA / Employment / Sales)
  * `location`: Australia / United States
  * `department`: any non-empty string

* **LLM-based extraction**

  * System prompt enforces strict JSON output
  * Uncertain fields must be returned as `null`
  * Results are whitelist-filtered to avoid invalid values

---

## Configuration & Running

* **Environment variables (`.env`)**

  * `OPENAI_API_KEY`
  * `OPENAI_BASE_URL`
  * `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
  * `PORT` (default: `5000`)

* **Run**

  * Development: `npm run dev` (ts-node)
  * Production: `npm start` (compiled output)

---

## Known Limitations / Future Improvements

* Rule engine only supports `equals`; could be extended with:

  * Case-insensitive matching
  * Set / list matching
  * Priority conflict detection
* Local file storage is not suitable for multi-instance or concurrent writes; migrate to a database.
* No authentication or rate limiting; can be added at the routing layer.
* No frontend configuration UI or rule management guide yet.
* LLM failures fall back to empty extraction; retries and alerting can be added.