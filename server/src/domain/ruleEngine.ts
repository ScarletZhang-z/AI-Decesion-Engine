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
  // Filter enabled rules and sort by priority descending
  const activeRules = rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.priority - a.priority);
  // Count known fields in session state
  const knownFieldCount = Object.values(sessionState).filter((value) => value != null).length;
  // To collect missing fields across candidate rules
  // Using a Set to ensure only ask once per field
  const missingAcrossCandidates = new Set<Field>();

  for (const rule of activeRules) {
    const conditions = rule.conditions;

    // find all fields used by this rule
    // deduplicate (the same field may appear multiple times)
    // find those not yet filled in sessionState
    const missingFieldsForRule = Array.from(new Set(rule.conditions.map((condition) => condition.field))).filter(
      (field) => sessionState[field] == null,
    );

    // if any known field mismatches, skip this rule
    const hasMismatch = conditions.some(
      (condition) => sessionState[condition.field] != null && sessionState[condition.field] !== condition.value,
    );
    if (hasMismatch) {
      continue;
    }

    // check if all conditions match
    const matches = conditions.every((condition) => sessionState[condition.field] === condition.value);
    if (matches) {
      return { status: 'matched', rule };
    }

    // count how many conditions match known fields
    const matchedKnownCount = conditions.filter(
      (condition) => sessionState[condition.field] != null && sessionState[condition.field] === condition.value,
    ).length;

    // if there are missing fields for this rule
    // and either some known fields match or there are no known fields at all
    // consider these missing fields as candidates to ask
    if (missingFieldsForRule.length > 0 && (matchedKnownCount > 0 || knownFieldCount === 0)) {
      missingFieldsForRule.forEach((field) => missingAcrossCandidates.add(field));
    }
  }

  // after evaluating all rules, if there are missing fields collected, return them
  if (missingAcrossCandidates.size > 0) {
    return { status: 'missing_fields', missingFields: Array.from(missingAcrossCandidates) };
  }
  // otherwise, no match
  return { status: 'no_match' };
};
