export type Field = "contractType" | "location" | "department";

export type Condition = {
  field: Field;
  operator: "equals";
  value: string;
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
