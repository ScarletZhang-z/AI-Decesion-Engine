import type { Field, Rule, RuleEvaluationSession } from './rules';

export type RuleEvaluationResult =
  | { status: 'matched'; rule: Rule }
  | { status: 'missing_fields'; missingFields: Field[] }
  | { status: 'no_match' };

const collectRequiredFields = (rules: Rule[]): Field[] => {
  const required = new Set<Field>();

  for (const rule of rules) {
    for (const condition of rule.conditions) {
      required.add(condition.field);
    }
  }

  return Array.from(required);
};

const findMatchingRule = (rules: Rule[], sessionState: RuleEvaluationSession): Rule | undefined =>
  rules.find((rule) => rule.conditions.every((condition) => sessionState[condition.field] === condition.value));

export const evaluateRules = ({
  rules,
  sessionState,
}: {
  rules: Rule[];
  sessionState: RuleEvaluationSession;
}): RuleEvaluationResult => {
  const activeRules = rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.priority - a.priority);

  const matchedRule = findMatchingRule(activeRules, sessionState);
  if (matchedRule) {
    return { status: 'matched', rule: matchedRule };
  }

  const requiredFields = collectRequiredFields(activeRules);
  const missingFields = requiredFields.filter((field) => sessionState[field] === null);

  if (missingFields.length > 0) {
    return { status: 'missing_fields', missingFields };
  }

  return { status: 'no_match' };
};
