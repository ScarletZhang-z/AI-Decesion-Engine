export type Field = 'contractType' | 'location' | 'department';

export type Operator = 'eq';

export type Condition = { field: Field; op: 'eq'; value: string };

export type RuleAction = { type: 'assign_email'; value: string };

export type Rule = {
  id: string;
  name?: string;
  enabled: boolean;
  priority: number;
  conditions: Condition[];
  action: RuleAction;
};

export type RuleEvaluationSession = Record<Field, string | null>;

export const getAssigneeEmail = (rule: Rule): string =>
  rule.action.type === 'assign_email' ? rule.action.value : '';
