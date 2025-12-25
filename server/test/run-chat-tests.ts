// scripts/run-chat-tests.ts
/* eslint-disable no-console */

/**
 * Automatically runs the main test scenarios for chat routing.
 * Depends on a running backend (default: http://localhost:8999). Does not depend on the frontend.
 *
 * Usage (recommended):
 *   API_BASE_URL=http://localhost:8999 npm run test
 *
 * Optional:
 *   RUN_LLM=1 npm run test
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

const desiredRules: Rule[] = [
  {
    name: "AU Sales -> John",
    enabled: true,
    priority: 10,
    conditions: [
      { field: "contractType", op: "eq", value: "Sales" },
      { field: "location", op: "eq", value: "Australia" },
    ],
    action: { type: "assign_email", value: "john@acme.com" },
  },
  {
    name: "US Employment -> Alice",
    enabled: true,
    priority: 10,
    conditions: [
      { field: "contractType", op: "eq", value: "Employment" },
      { field: "location", op: "eq", value: "United States" },
    ],
    action: { type: "assign_email", value: "alice@acme.com" },
  },
  {
    name: "UK NDA -> Bob",
    enabled: true,
    priority: 9,
    conditions: [
      { field: "contractType", op: "eq", value: "NDA" },
      { field: "location", op: "eq", value: "United Kingdom" },
    ],
    action: { type: "assign_email", value: "bob@acme.com" },
  },
  {
    name: "AU Marketing -> Chloe",
    enabled: true,
    priority: 8,
    conditions: [
      { field: "department", op: "eq", value: "Marketing" },
      { field: "location", op: "eq", value: "Australia" },
    ],
    action: { type: "assign_email", value: "chloe@acme.com" },
  },
  {
    name: "Global HR -> Dana",
    enabled: true,
    priority: 6,
    conditions: [{ field: "department", op: "eq", value: "HR" }],
    action: { type: "assign_email", value: "dana@acme.com" },
  },
  {
    name: "Global Sales (low) -> Eve",
    enabled: true,
    priority: 1,
    conditions: [{ field: "contractType", op: "eq", value: "Sales" }],
    action: { type: "assign_email", value: "eve@acme.com" },
  },
];

const scenarios: Scenario[] = [
  {
    name: "AU Sales full match",
    messages: ["I have a Sales contract in Australia"],
    expectContains: "john@acme.com",
  },
  {
    name: "Missing fields multi-turn: Employment US",
    messages: ["Need a contract reviewed", "Employment", "United States"],
    expectContains: "alice@acme.com",
  },
  {
    name: "Alias: Sales + Sydney",
    messages: ["commercial deal from Sydney", "Sales", "Australia"],
    expectContains: "john@acme.com",
  },
  {
    name: "Department rule: Marketing AU",
    messages: ["Marketing campaign approval, I'm in Melbourne", "Marketing", "Australia"],
    expectContains: "chloe@acme.com",
  },
  {
    name: "Department only: HR",
    messages: ["HR policy question about probation", "HR"],
    expectContains: "dana@acme.com",
  },
  {
    name: "Low-priority Sales fallback",
    messages: ["Sales contract in Brazil"],
    expectContains: "eve@acme.com",
  },
  {
    name: "No match fallback",
    messages: ["Travel reimbursement for Canada"],
    expectContains: "legal@acme.corp",
  },
];

if (RUN_LLM) {
  scenarios.push({
    name: "LLM extraction: Employment US (requires API key)",
    messages: ["I'm hiring a backend engineer", "Based in NYC"],
    expectContains: "alice@acme.com",
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

async function createRule(rule: Rule): Promise<Rule> {
  return http<Rule>("/api/rules", {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

async function updateRule(id: string, rule: Rule): Promise<Rule> {
  return http<Rule>(`/api/rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(rule),
  });
}

async function ensureRules(): Promise<void> {
  const existing = await getRules();
  for (const rule of desiredRules) {
    const found = existing.find((r) => r.name === rule.name);
    if (found) continue;
    await createRule(rule);
    process.stdout.write(`Seeded rule: ${rule.name}\n`);
  }
}

async function setRuleEnabled(name: string, enabled: boolean): Promise<void> {
  const existing = await getRules();
  const rule = existing.find((r) => r.name === name);
  if (!rule?.id) throw new Error(`Rule not found: ${name}`);
  await updateRule(rule.id, { ...rule, enabled });
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
  await ensureRules();

  const results: ResultRow[] = [];

  // Run main scenarios
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

  // Conversation restore test using the first scenario's conversation
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

  // Disable high priority rule and test fallback, then re-enable
  try {
    await setRuleEnabled("AU Sales -> John", false);
    const res = await runScenario({
      name: "Fallback after disabling high-priority rule",
      messages: ["Sales contract in Australia"],
      expectContains: "eve@acme.com",
    });
    results.push({ name: "Fallback after disabling high-priority rule", passed: res.passed, ...res });
    console.log(`${res.passed ? "✅" : "❌"} Fallback after disabling high-priority rule -> ${res.lastResponse}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name: "Fallback after disabling high-priority rule", passed: false, error: msg });
    console.error(`❌ Fallback after disabling high-priority rule error: ${msg}`);
  } finally {
    // best effort re-enable
    try {
      await setRuleEnabled("AU Sales -> John", true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`⚠️  Failed to re-enable AU Sales -> John: ${msg}`);
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
