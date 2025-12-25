// scripts/run-chat-tests.ts
/* eslint-disable no-console */

/**
 * E2E chat routing checks against the running backend.
 * Default target: http://localhost:8999 (override with API_BASE_URL).
 *
 * Usage:
 *   API_BASE_URL=http://localhost:8999 npm run test
 *
 * Optional:
 *   RUN_LLM=1 npm run test   # adds an LLM extraction scenario (requires OPENAI_API_KEY)
 */

type SessionField = "contractType" | "location" | "department" | (string & {});

type Condition = { field: SessionField; op: "eq"; value: string };

type Rule = {
  id?: string;
  name?: string;
  enabled: boolean;
  priority: number;
  conditions: Condition[];
  action: { type: "assign_email"; value: string };
};

type Scenario = {
  name: string;
  messages: string[];
  expectContains?: string;
};

type ChatResponseDTO = {
  conversationId: string;
  response: string;
  quickReplies?: string[];
};

type ConversationDTO = {
  history?: unknown[];
  [k: string]: unknown;
};

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8999";
const RUN_LLM =
  process.env.RUN_LLM === "1" ||
  process.env.RUN_LLM === "true" ||
  Boolean(process.env.OPENAI_API_KEY);
const FALLBACK_EMAIL = process.env.FALLBACK_EMAIL || "legal@acme.corp";

const REQUIRED_RULES: Array<{ id: string; enabled: boolean }> = [
  { id: "R950_Sales_GlobalTop", enabled: true },
  { id: "R900_Sales_AU_Engineer", enabled: true },
  { id: "R900_Sales_AU", enabled: true },
  { id: "R820_NDA_US_HR", enabled: true },
  { id: "R780_Employment_SG_HR", enabled: true },
  { id: "R770_Employment_SG", enabled: true },
  { id: "R740_Employment", enabled: true },
  { id: "R510_Tie_ContractType_Ops", enabled: true },
  { id: "R511_Tie_Location_Ops", enabled: true },
  { id: "R999_Disabled_Sales_Engineer", enabled: false },
];

const scenarios: Scenario[] = [
  {
    name: "Sales AU Engineer: asks then picks highest priority",
    messages: ["Hi", "Australia", "Sales", "Engineer"],
    expectContains: "sales-top@company.test",
  },
  {
    name: "NDA United States HR: specific beats general NDA",
    messages: ["Hello", "United States", "NDA", "HR"],
    expectContains: "nda-us-hr@company.test",
  },
  {
    name: "Employment Singapore HR: multi-step ask path",
    messages: ["Hi there", "Singapore", "Employment", "HR"],
    expectContains: "employment-sg-hr@company.test",
  },
  {
    name: "Fallback when no rule matches",
    messages: ["Need help with a unique contract", "Canada", "Partnership", "HR"],
    expectContains: FALLBACK_EMAIL,
  },
];

if (RUN_LLM) {
  scenarios.push({
    name: "LLM extraction: one-shot Sales AU Engineer (requires API key)",
    messages: ["I need a sales contract in Australia for our engineering team"],
    expectContains: "sales-top@company.test",
  });
}

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

async function getRules(): Promise<Rule[]> {
  return http<Rule[]>("/api/rules");
}

async function ensureRequiredRules(): Promise<void> {
  const existing = await getRules();
  const missing = REQUIRED_RULES.filter((req) => !existing.some((rule) => rule.id === req.id));
  if (missing.length) {
    throw new Error(
      `Missing required rules: ${missing.map((m) => m.id).join(", ")}. ` +
        "Restart the backend to load server/data/rules.json."
    );
  }

  const wrongEnabled = REQUIRED_RULES.filter((req) => {
    const found = existing.find((rule) => rule.id === req.id);
    return found && found.enabled !== req.enabled;
  });

  if (wrongEnabled.length) {
    throw new Error(
      `Rules with unexpected enabled state: ${wrongEnabled
        .map((r) => `${r.id} (expected ${r.enabled ? "enabled" : "disabled"})`)
        .join(", ")}`
    );
  }
}

async function chat(userMessage: string, conversationId?: string | null): Promise<ChatResponseDTO> {
  const payload: { userMessage: string; conversationId?: string } = { userMessage };
  if (conversationId) payload.conversationId = conversationId;

  return http<ChatResponseDTO>("/api/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function fetchConversation(id: string): Promise<ConversationDTO> {
  return http<ConversationDTO>(`/api/conversations/${id}`);
}

async function runScenario(scenario: Scenario): Promise<{
  passed: boolean;
  conversationId: string | null;
  lastResponse: string;
}> {
  let conversationId: string | null = null;
  let lastResponse = "";

  for (const msg of scenario.messages) {
    const data = await chat(msg, conversationId);
    conversationId = data.conversationId;
    lastResponse = data.response || "";
  }

  const passed =
    !scenario.expectContains ||
    lastResponse.toLowerCase().includes(scenario.expectContains.toLowerCase());

  return { passed, conversationId, lastResponse };
}

type ResultRow =
  | { name: string; passed: true; conversationId?: string | null; lastResponse?: string }
  | { name: string; passed: false; conversationId?: string | null; lastResponse?: string; error?: string };

async function run(): Promise<void> {
  console.log(`API base: ${BASE_URL}`);
  await ensureRequiredRules();

  const results: ResultRow[] = [];

  for (const scenario of scenarios) {
    try {
      const res = await runScenario(scenario);
      results.push({ name: scenario.name, passed: res.passed, ...res });
      console.log(
        `${res.passed ? "✅" : "❌"} ${scenario.name} -> ${res.lastResponse} (conversation ${res.conversationId})`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: scenario.name, passed: false, error: msg });
      console.error(`❌ ${scenario.name} error: ${msg}`);
    }
  }

  if (results.length) {
    const convId = (results[0] as any).conversationId as string | undefined;
    if (convId) {
      try {
        const conv = await fetchConversation(convId);
        const ok = Array.isArray(conv.history) && conv.history.length >= 2;
        results.push({ name: "Conversation restore", passed: ok, conversationId: convId });
        console.log(`${ok ? "✅" : "❌"} Conversation restore (history length ${(conv.history as any[])?.length})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ name: "Conversation restore", passed: false, error: msg });
        console.error(`❌ Conversation restore error: ${msg}`);
      }
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log(
    `\nSummary: ${passedCount}/${results.length} passed. ${
      RUN_LLM ? "LLM scenario executed." : "LLM scenario skipped (set RUN_LLM=1 to enable)."
    }`
  );

  const failed = results.filter((r) => !r.passed);
  if (failed.length) {
    console.log("Failed scenarios:");
    for (const f of failed) {
      console.log(`- ${f.name}${"error" in f && f.error ? ` (${f.error})` : ""}`);
    }
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
