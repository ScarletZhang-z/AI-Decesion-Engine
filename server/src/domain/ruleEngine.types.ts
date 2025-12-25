import type { Field, Rule, RuleEvaluationSession } from './rules';

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
