import type { Field, Rule, RuleEvaluationSession } from './rules';

export type RuleEvaluationResult =
  | { status: 'matched'; rule: Rule }
  | { status: 'missing_fields'; missingFields: Field[] }
  | { status: 'no_match' };

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

  for (const rule of activeRules) {
    const missingFieldsForRule = Array.from(new Set(rule.conditions.map((condition) => condition.field))).filter(
      (field) => sessionState[field] == null,
    );

    if (missingFieldsForRule.length > 0) {
      return { status: 'missing_fields', missingFields: missingFieldsForRule };
    }

    const matches = rule.conditions.every((condition) => sessionState[condition.field] === condition.value);
    if (matches) {
      return { status: 'matched', rule };
    }
  }

  const requiredFields = Array.from(
    new Set(activeRules.flatMap((rule) => rule.conditions.map((condition) => condition.field))),
  );
  const missingFields = requiredFields.filter((field) => sessionState[field] == null);

  if (missingFields.length > 0) {
    return { status: 'missing_fields', missingFields };
  }

  return { status: 'no_match' };
};
