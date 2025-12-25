import type { Condition, Field, Rule, RuleEvaluationSession } from './rules';
import type { OneRuleEval } from './ruleEngine.types';

const hasValue = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value !== '';

const describeEqMismatch = (condition: Condition, sessionValue: string | null | undefined): string => {
  const actual = hasValue(sessionValue) ? JSON.stringify(sessionValue) : 'missing';
  return `field ${condition.field} expected ${JSON.stringify(condition.value)} got ${actual}`;
};

export const evaluateOneRule = (rule: Rule, sessionState: RuleEvaluationSession): OneRuleEval => {
  const missingFields: Field[] = [];
  let matchedKnownCount = 0;

  for (const condition of rule.conditions) {
    const sessionValue = sessionState[condition.field];
    if (!hasValue(sessionValue)) {
      missingFields.push(condition.field);
      continue;
    }

    if (sessionValue !== condition.value) {
      return {
        state: 'contradicted',
        ruleId: rule.id,
        priority: rule.priority,
        specificity: rule.conditions.length,
        matchedKnownCount,
        reason: describeEqMismatch(condition, sessionValue),
      };
    }

    matchedKnownCount += 1;
  }

  const uniqueMissing = Array.from(new Set(missingFields));

  if (uniqueMissing.length === 0) {
    return {
      state: 'satisfied',
      ruleId: rule.id,
      priority: rule.priority,
      specificity: rule.conditions.length,
      matchedKnownCount,
    };
  }

  return {
    state: 'eligible',
    ruleId: rule.id,
    priority: rule.priority,
    specificity: rule.conditions.length,
    matchedKnownCount,
    missingFields: uniqueMissing,
  };
};
