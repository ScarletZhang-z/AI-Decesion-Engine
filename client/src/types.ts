export type Field = "contractType" | "location" | "department";

export type Condition = {
  field: Field;
  operator: "equals";
  value: string;
};

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
  name: string;
  enabled: boolean;
  priority: number;
  conditions: Condition[];
  assigneeEmail: string;
};

export type RulePayload = Omit<Rule, "id">;
