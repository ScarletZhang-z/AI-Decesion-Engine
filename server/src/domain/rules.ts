export type Field = 'contractType' | 'location' | 'department';
export type Operator = 'equals';

export type Condition = {
  field: Field;
  operator: Operator;
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

export type RuleEvaluationSession = Record<Field, string | null>;

export type RuleEvaluation = {
  status: 'matched' | 'missing_fields' | 'no_match';
  rule?: Rule;
  missingFields?: Field[];
}
