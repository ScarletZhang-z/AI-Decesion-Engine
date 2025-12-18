# Implementation Overview (v2.0.0)

Implementation summary of the current backend and frontend based on the checked-in code.

## Architecture Layers

* **Entry point (`server/src/index.ts`)**
  Express bootstrap configuring CORS and JSON parsing, wiring OpenAI client, rule repository (in-memory array backed by JSON file), conversation repository (in-memory with disk persistence), LLM field extractor, rule router, and chat service. Registers `/api/rules`, `/api/conversations`, `/api/chat`, and `/health`.

* **HTTP routes (`server/src/routes/`)**
  * `rules.ts`: CRUD for rules with validation and JSON persistence to `server/data/rules.json`.
  * `conversations.ts`: read conversation history by ID.

* **Application layer (`server/src/application/`)**
  * `conversations/`: chat orchestration, conversation repository, deterministic field parsers, LLM field extractor, and response composition.
  * `routing/ruleRouter.ts`: loads rules and wraps rule engine results into routing decisions with optional debug data.
  * `nextQuestionSelector.ts`: chooses which missing field to ask next based on enabled rules.
  * `responseComposer.ts` and `llmCopywriter.ts`: build response plans and optionally rewrite responses via OpenAI.
  * `normalizers.ts`: canonicalizes field values using `server/data/fieldAliases.json`.

* **Domain (`server/src/domain/`)**
  Rule and conversation types plus pure rule evaluation (`ruleEngine.ts`) and session/history management (`conversation.ts`).

* **Client (`client/src/`)**
  React SPA with two pages: `ChatPage` for chat interaction and `ConfigurePage` for rule management, using `api.ts` fetch helpers. Routing shell in `App.tsx`.

## `/api/chat` Request Flow

1. Validate `userMessage` is a non-empty string; derive optional `conversationId`.
2. Load conversation from memory or `server/data/conversations/{id}.json`; create a new one if absent; append user message to history.
3. If a `pendingField` is set, try deterministic parsing for that field (`parseAnswerForField` for contract type/location/department).
4. If no pending parse succeeded, run `llmFieldExtractor.extractWithLLM` (OpenAI chat completion with JSON response) to fill any confident fields; skipped when `OPENAI_API_KEY` is unset.
5. Route current session state through `ruleRouter` (uses `evaluateRules` over enabled rules sorted by priority):
   * `matched`: capture `assigneeEmail`, clear `pendingField`.
   * `missing_fields`: choose up to two fields to ask (ordered by required fields, optionally guided by `selectNextField`), set first as `pendingField`.
   * `no_match`/`no_rules`: clear `pendingField`, no assignee.
6. Compose a response plan (`composePlan`) with ask/final/fallback text templates and optional quick replies; fallback email defaults to `legal@acme.corp`. Optionally rewrite via OpenAI (`rewriteWithLLM`) if API key is set and rewritten text passes validator; otherwise use template.
7. Append assistant reply to history, persist conversation (memory + JSON file), and return `{ conversationId, response, quickReplies? }`.

## Rule Management API (`/api/rules`)

* **GET `/`**: return current in-memory rule list.
* **POST `/`**: validate and create rule (UUID `id`, required `name`, `conditions`, `assigneeEmail`; optional `enabled`, `priority`), persist to JSON.
* **PUT `/:id`**: validate and overwrite existing rule fields; 404 if missing.
* **DELETE `/:id`**: remove rule; 404 if missing.

Validation constraints: allowed fields `contractType|location|department`, operator must be `equals`, `conditions` non-empty, `priority` finite number, `assigneeEmail` must match email regex.

## Conversation Storage & Expiry

* In-memory `Map` plus JSON persistence under `server/data/conversations/{conversationId}.json`; `save` writes immediately, `get` hydrates from disk on cache miss.
* Expiry: `EXPIRY_MS = 30 minutes`; `setInterval` every 60s evicts inactive conversations after attempting persistence; files are not deleted.
* Conversation shape: `id`, `sessionState` (contractType/location/department as string|null), `pendingField`, ordered `history` entries `{ role, content, ts }`, and `lastActiveAt`.

## Rule Evaluation & Field Selection

* `ruleEngine.evaluateRules`: filters enabled rules, sorts by descending `priority`, finds first rule whose conditions all match session values; otherwise reports missing fields (those required by enabled rules with null session values) or `no_match`.
* `ruleRouter.route`: loads rules from repository, converts engine results into routing decisions and optional debug metadata (evaluated rule IDs, priorities, enabled flags, reason).
* `selectNextField`: prefers missing fields that discriminate across candidate enabled rules (by distinct condition values/count), falling back to default order.

## Field Parsing and Normalization

* Deterministic parsers (`fieldParsers.ts`) for pending answers:
  * `contractType`: normalized via aliases/title case; max length 50.
  * `location`: normalized via aliases/title case; dots replaced; max length 50.
  * `department`: normalized via aliases/title case; max length 80.
* LLM extractor (`llmFieldExtractor.ts`): prompts OpenAI with recent history and known fields; expects strict JSON; normalizes outputs via alias mappings in `server/data/fieldAliases.json`; on failure returns empty update.
* Session updates ignore undefined and null values; department is trimmed on update.

## Frontend Behavior

* **ChatPage**: reads `conversationId` from query string to load history via `/api/conversations/:id`; sends messages to `/api/chat`; appends responses; exposes “Start new chat” to reset state and URL.
* **ConfigurePage**: loads rules on mount; provides create/update/delete with client-side validation (name, email, numeric priority, non-empty conditions/values); lists rules sorted by priority then name; uses window confirm for deletes.
* Quick replies returned from chat API are not rendered in the current chat UI.

## Notable Behaviors / Constraints

* OpenAI-dependent steps (field extraction, copy rewriting) are skipped when `OPENAI_API_KEY` is absent; a startup warning is logged.
* Rule evaluation only supports `equals` operator and the three fixed fields.
* Conversation eviction only removes from memory; persisted files remain.
* Fallback routing uses `legal@acme.corp` when no match or no rules; provided rules are read from `server/data/rules.json` at startup and kept in-memory thereafter.
