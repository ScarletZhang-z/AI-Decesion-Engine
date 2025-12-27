import type { Rule } from '../../../domain/rules.types';

// Raw HTTP payload shape for creating/updating rules.
// Kept permissive; validation happens in the route layer.
export type RuleRequestDTO = Record<string, unknown>;

export type ConditionResponseDTO = {
  field: string;
  op: string;
  value: string;
};

export type RuleResponseDTO = {
  id: string;
  name?: string;
  enabled: boolean;
  priority: number;
  conditions: ConditionResponseDTO[];
  action: { type: string; value: string };
};

export const toRuleRequestDTO = (input: unknown): RuleRequestDTO =>
  input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

export const toRuleResponseDTO = (rule: Rule): RuleResponseDTO => ({
  id: rule.id,
  name: rule.name,
  enabled: rule.enabled,
  priority: rule.priority,
  conditions: rule.conditions.map((c) => ({
    field: c.field,
    op: c.op,
    value: c.value,
  })),
  action: { type: rule.action.type, value: rule.action.value },
});

export const toRuleListResponseDTO = (rules: Rule[]): RuleResponseDTO[] =>
  rules.map((rule) => toRuleResponseDTO(rule));
