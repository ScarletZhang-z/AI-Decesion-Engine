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

  const knownFieldCount = Object.values(sessionState).filter((value) => value != null).length;
  const missingAcrossCandidates = new Set<Field>();

  for (const rule of activeRules) {
    const conditions = rule.conditions;

    const missingFieldsForRule = Array.from(new Set(rule.conditions.map((condition) => condition.field))).filter(
      (field) => sessionState[field] == null,
    );

    const hasMismatch = conditions.some(
      (condition) => sessionState[condition.field] != null && sessionState[condition.field] !== condition.value,
    );
    if (hasMismatch) {
      continue;
    }

    const matches = conditions.every((condition) => sessionState[condition.field] === condition.value);
    if (matches) {
      return { status: 'matched', rule };
    }

    const matchedKnownCount = conditions.filter(
      (condition) => sessionState[condition.field] != null && sessionState[condition.field] === condition.value,
    ).length;

    if (missingFieldsForRule.length > 0 && (matchedKnownCount > 0 || knownFieldCount === 0)) {
      missingFieldsForRule.forEach((field) => missingAcrossCandidates.add(field));
    }
  }

  if (missingAcrossCandidates.size > 0) {
    return { status: 'missing_fields', missingFields: Array.from(missingAcrossCandidates) };
  }

  return { status: 'no_match' };
};
