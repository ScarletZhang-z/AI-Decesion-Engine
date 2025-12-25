import { selectNextField } from '../application/nextQuestionSelector';
import { Candidates, EvalOutput } from './ruleEngine.types';
import { evaluateOneRule } from './ruleEvaluation';
import type { Field, Rule, RuleEvaluationSession } from './rules';

export type { OneRuleEval, Candidates, EvalOutput } from './ruleEngine.types';
export { evaluateOneRule } from './ruleEvaluation';

const DEFAULT_FIELD_ORDER: Field[] = ['contractType', 'location', 'department'];

const rankCandidates = ({
  rules,
  sessionState,
}: {
  rules: Rule[];
  sessionState: RuleEvaluationSession;
}): {
  bestSatisfied?: { ruleId: string; specificity: number; priority: number; matchedKnownCount: number };
  bestEligible?: { ruleId: string; missingFields: Field[]; specificity: number; priority: number; matchedKnownCount: number };
  candidateRulesForNextField: Rule[];
  debug: Candidates;
} => {
  const satisfied: Candidates['satisfied'] = [];
  const eligible: Candidates['eligible'] = [];
  const contradicted: NonNullable<Candidates['contradicted']> = [];

  const satisfiedRules: Rule[] = [];
  const eligibleRules: Rule[] = [];

  for (const rule of rules) {
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

  return {
    bestSatisfied,
    bestEligible,
    candidateRulesForNextField: pickBestEligibleGroup(),
    debug,
  };
};

const chooseNextField = (sessionState: RuleEvaluationSession, candidateRules: Rule[]): Field => {
  const selection = selectNextField({
    known: sessionState,
    rules: candidateRules,
    defaultOrder: DEFAULT_FIELD_ORDER,
  });

  return selection.field;
};

export const evaluateRules = ({
  rules,
  sessionState,
}: {
  rules: Rule[];
  sessionState: RuleEvaluationSession;
}): EvalOutput => {
  const activeRules = rules.filter((rule) => rule.enabled);

  const {
    bestSatisfied,
    bestEligible,
    candidateRulesForNextField,
    debug,
  } = rankCandidates({ rules: activeRules, sessionState });

  const decisionShouldAsk =
    bestEligible &&
    (!bestSatisfied || bestEligible.specificity > bestSatisfied.specificity);

  if (decisionShouldAsk || (bestEligible && !bestSatisfied)) {
    const nextField = chooseNextField(sessionState, candidateRulesForNextField);
    return { decision: 'ask', nextField, debug };
  }

  if (bestSatisfied) {
    return { decision: 'matched', chosenRuleId: bestSatisfied.ruleId, debug };
  }

  if (bestEligible) {
    const nextField = chooseNextField(sessionState, candidateRulesForNextField);
    return { decision: 'ask', nextField, debug };
  }

  return { decision: 'fallback', debug };
};
