import type { RuleEvaluationSession, Rule, Field } from '../../domain/rules';
import { getAssigneeEmail } from '../../domain/rules';
import { evaluateRules, type Candidates } from '../../domain/ruleEngine';

export type RuleRepository = {
  getAll(): Promise<Rule[]> | Rule[];
};

export type RoutingDebugInfo = {
  evaluatedRules: Array<{ id: string; priority: number; enabled: boolean }>;
  candidates?: Candidates;
  reason?: string;
};

export type RoutingDecision =
  | { status: 'matched'; assigneeEmail: string; matchedRuleId: string; debug?: RoutingDebugInfo }
  | { status: 'missing_fields'; fields: Field[]; rules?: Rule[]; debug?: RoutingDebugInfo }
  | { status: 'no_match'; debug?: RoutingDebugInfo }
  | { status: 'no_rules'; debug?: RoutingDebugInfo }
  | { status: 'error'; message: string; debug?: RoutingDebugInfo };

export type RouteParams = {
  sessionState: RuleEvaluationSession;
  includeDebug?: boolean;
};

export type Router = {
  route(params: RouteParams): Promise<RoutingDecision>;
};

const buildDebugInfo = (rules: Rule[], reason?: string, candidates?: Candidates): RoutingDebugInfo => ({
  evaluatedRules: rules.map((rule) => ({
    id: rule.id,
    priority: rule.priority,
    enabled: rule.enabled,
  })),
  reason,
  candidates,
});

export const createRuleRouter = ({
  repository,
  engine = evaluateRules,
}: {
  repository: RuleRepository;
  engine?: typeof evaluateRules;
}): Router => ({
  async route({ sessionState, includeDebug = false }: RouteParams): Promise<RoutingDecision> {
    let rules: Rule[];
    try {
      const loaded = await repository.getAll();
      rules = Array.isArray(loaded) ? loaded : [];
    } catch (error) {
      const debug = includeDebug ? buildDebugInfo([], 'rule repository error') : undefined;
      return { status: 'error', message: 'failed_to_load_rules', debug };
    }

    if (rules.length === 0) {
      const debug = includeDebug ? buildDebugInfo([], 'no rules available') : undefined;
      return { status: 'no_rules', debug };
    }

    const evaluation = engine({ rules, sessionState });
    const debug = includeDebug ? buildDebugInfo(rules, evaluation.decision, evaluation.debug) : undefined;

    if (evaluation.decision === 'matched') {
      const matchedRule = rules.find((rule) => rule.id === evaluation.chosenRuleId);
      if (!matchedRule) {
        return { status: 'error', message: 'matched_rule_not_found', debug };
      }
      return {
        status: 'matched',
        matchedRuleId: matchedRule.id,
        assigneeEmail: getAssigneeEmail(matchedRule),
        debug,
      };
    }

    if (evaluation.decision === 'ask') {
      return { status: 'missing_fields', fields: [evaluation.nextField], debug };
    }

    return { status: 'no_match', debug };
  },
});
