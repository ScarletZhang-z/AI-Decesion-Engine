# Implementation Overview (v1.2.0)

This note captures backend changes since `implementation-v1.1.0.md` based on the current code.

## Changes since v1.1.0

- **Rule evaluation (server/src/domain/ruleEngine.ts)**: now skips rules with explicit field mismatches before asking for missing info, aggregates missing fields only from partially matching or empty-context rules, and avoids prompting when all candidates are ruled out by conflicts.
- **LLM field extraction (server/src/application/conversations/llmFieldExtractor.ts)**: uses `response_format: json_schema` with a strict `TriageFields` schema to force outputs to exactly `contractType | location | department`; still normalizes values via alias mappings.
- **Default rules data (server/data/rules.json)**: refreshed seed set to include AU Sales, US Employment, UK NDA, AU Marketing, Global HR, and a low-priority Global Sales fallback; removed duplicate/placeholder entries and normalized naming.
- **Persistence housekeeping**: conversation persistence directory is git-ignored and the previous sample conversation file was removed.
- **Tooling/tests**: backend `npm test` now runs `server/test/run-chat-tests.ts`, and `docs/test-cases.md` describes the E2E chat routing scenarios.
