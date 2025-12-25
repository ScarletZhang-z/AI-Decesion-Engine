import { selectNextField } from '../application/nextQuestionSelector';
import type { Condition, Field, Rule, RuleEvaluationSession } from './rules';

export type OneRuleEval =
  | {
      state: 'contradicted';
      ruleId: string;
      priority: number;
      specificity: number;
      matchedKnownCount: number;
      reason: string;
    }
  | {
      state: 'satisfied';
      ruleId: string;
      priority: number;
      specificity: number;
      matchedKnownCount: number;
    }
  | {
      state: 'eligible';
      ruleId: string;
      priority: number;
      specificity: number;
      matchedKnownCount: number;
      missingFields: Field[];
    };

export type Candidates = {
  satisfied: Array<{ ruleId: string; specificity: number; priority: number; matchedKnownCount: number }>;
  eligible: Array<{ ruleId: string; missingFields: Field[]; specificity: number; priority: number; matchedKnownCount: number }>;
  contradicted?: Array<{ ruleId: string; reason: string; specificity: number; priority: number; matchedKnownCount: number }>;
};

export type EvalOutput =
  | { decision: 'matched'; chosenRuleId: string; debug: Candidates }
  | { decision: 'ask'; nextField: Field; debug: Candidates }
  | { decision: 'fallback'; debug: Candidates };

const DEFAULT_FIELD_ORDER: Field[] = ['contractType', 'location', 'department'];

const hasValue = (value: string | null | undefined): value is string => value !== null && value !== undefined && value !== '';

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

export const evaluateRules = ({
  rules,
  sessionState,
}: {
  rules: Rule[];
  sessionState: RuleEvaluationSession;
}): EvalOutput => {
  const activeRules = rules.filter((rule) => rule.enabled);

  const satisfied: Candidates['satisfied'] = [];
  const eligible: Candidates['eligible'] = [];
  const contradicted: NonNullable<Candidates['contradicted']> = [];

  const satisfiedRules: Rule[] = [];
  const eligibleRules: Rule[] = [];

  for (const rule of activeRules) {
    const result = evaluateOneRule(rule, sessionState);
    if (result.state === 'satisfied') {
      satisfied.push({
        ruleId: result.ruleId,
        specificity: result.specificity,
        priority: result.priority,
        matchedKnownCount: result.matchedKnownCount,
      });
      satisfiedRules.push(rule);
    } else if (result.state === 'eligible') {
      eligible.push({
        ruleId: result.ruleId,
        missingFields: result.missingFields,
        specificity: result.specificity,
        priority: result.priority,
        matchedKnownCount: result.matchedKnownCount,
      });
      eligibleRules.push(rule);
    } else {
      contradicted.push({
        ruleId: result.ruleId,
        reason: result.reason,
        specificity: result.specificity,
        priority: result.priority,
        matchedKnownCount: result.matchedKnownCount,
      });
    }
  }

  const bestSatisfied = [...satisfied].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.specificity - a.specificity;
  })[0];

  const bestEligible = [...eligible].sort((a, b) => {
    if (b.matchedKnownCount !== a.matchedKnownCount) return b.matchedKnownCount - a.matchedKnownCount;
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    return b.priority - a.priority;
  })[0];

  const pickBestEligibleGroup = (): Rule[] => {
    if (!bestEligible) {
      return [];
    }
    const groupIds = new Set(
      eligible
        .filter(
          (entry) =>
            entry.matchedKnownCount === bestEligible.matchedKnownCount &&
            entry.specificity >= bestEligible.specificity,
        )
        .map((entry) => entry.ruleId),
    );

    const groupRules = eligibleRules.filter((rule) => groupIds.has(rule.id));
    return groupRules.length > 0 ? groupRules : eligibleRules;
  };

  const debug: Candidates = {
    satisfied,
    eligible,
    contradicted: contradicted.length > 0 ? contradicted : undefined,
  };

  const decisionShouldAsk =
    bestEligible &&
    (!bestSatisfied || bestEligible.specificity > bestSatisfied.specificity);

  if (decisionShouldAsk || (bestEligible && !bestSatisfied)) {
    const candidateRules = pickBestEligibleGroup();
    const selection = selectNextField({
      known: sessionState,
      rules: candidateRules,
      defaultOrder: DEFAULT_FIELD_ORDER,
    });

    const nextField = selection.field;
    return { decision: 'ask', nextField, debug };
  }

  if (bestSatisfied) {
    return { decision: 'matched', chosenRuleId: bestSatisfied.ruleId, debug };
  }

  if (bestEligible) {
    const candidateRules = pickBestEligibleGroup();
    const selection = selectNextField({
      known: sessionState,
      rules: candidateRules,
      defaultOrder: DEFAULT_FIELD_ORDER,
    });
    const nextField = selection.field;
    return { decision: 'ask', nextField, debug };
  }

  return { decision: 'fallback', debug };
};
