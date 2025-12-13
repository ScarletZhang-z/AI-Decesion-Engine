import type { RuleEvaluationSession, Rule, Field } from '../../domain/rules';
import { evaluateRules } from '../../domain/ruleEngine';

export type RuleRepository = {
  getAll(): Promise<Rule[]> | Rule[];
};

export type RoutingDebugInfo = {
  evaluatedRules: Array<{ id: string; priority: number; enabled: boolean }>;
  reason?: string;
};

export type RoutingDecision =
  | { status: 'matched'; assigneeEmail: string; matchedRuleId: string; debug?: RoutingDebugInfo }
  | { status: 'missing_fields'; fields: Field[]; debug?: RoutingDebugInfo }
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

const buildDebugInfo = (rules: Rule[], reason?: string): RoutingDebugInfo => ({
  evaluatedRules: rules.map((rule) => ({
    id: rule.id,
    priority: rule.priority,
    enabled: rule.enabled,
  })),
  reason,
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
    const debugReason =
      evaluation.status === 'matched'
        ? `matched rule ${evaluation.rule.id}`
        : evaluation.status === 'missing_fields'
          ? `missing fields: ${evaluation.missingFields.join(',')}`
          : evaluation.status === 'no_match'
            ? 'no matching rule'
            : '';
    const debug = includeDebug ? buildDebugInfo(rules, debugReason) : undefined;

    if (evaluation.status === 'matched') {
      return { status: 'matched', matchedRuleId: evaluation.rule.id, assigneeEmail: evaluation.rule.assigneeEmail, debug };
    }

    if (evaluation.status === 'missing_fields') {
      return { status: 'missing_fields', fields: evaluation.missingFields, debug };
    }

    return { status: 'no_match', debug };
  },
});
