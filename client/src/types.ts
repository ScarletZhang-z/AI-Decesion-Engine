export type Field = "contractType" | "location" | "department";

export type Operator = "eq";

export type Condition = { field: Field; op: "eq"; value: string };

export type Role = "user" | "assistant";

export type ConversationHistoryEntry = {
  role: Role;
  content: string;
  ts: number;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  ts?: number;
};

export type Rule = {
  id: string;
  name?: string;
  enabled: boolean;
  priority: number;
  conditions: Condition[];
  action: { type: "assign_email"; value: string };
};

export type RulePayload = Omit<Rule, "id">;
