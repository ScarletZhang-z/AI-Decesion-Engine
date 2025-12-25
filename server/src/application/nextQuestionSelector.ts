import type { Rule, Field } from '../domain/rules';

export type FieldName = Field;

type SelectArgs = {
  known: Partial<Record<FieldName, string | null>>;
  rules: Rule[];
  defaultOrder: FieldName[];
};

type FieldStats = {
  count: number;
  values: Set<string>;
};

const isKnown = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value !== '';

const matchesKnownCondition = (
  condition: Rule['conditions'][number],
  knownValue: string | null | undefined,
): boolean => {
  if (!isKnown(knownValue)) {
    return true;
  }

  return knownValue === condition.value;
};

const describeConditionValue = (condition: Rule['conditions'][number]): string => {
  return condition.value;
};

const pickFallbackField = (missingCandidates: FieldName[], defaultOrder: FieldName[]): FieldName =>
  missingCandidates[0] ?? defaultOrder[0];

export function selectNextField({ known, rules, defaultOrder }: SelectArgs): { field: FieldName; reason: string } {
  const missingCandidates = defaultOrder.filter((field) => !isKnown(known[field]));

  const candidateRules = rules
    .filter((rule) => rule.enabled)
    .filter((rule) =>
      rule.conditions.every((condition) => matchesKnownCondition(condition, known[condition.field])),
    );

  if (candidateRules.length === 0) {
    const field = pickFallbackField(missingCandidates, defaultOrder);
    return { field, reason: 'fallback_no_candidate_rules' };
  }

  const stats = new Map<FieldName, FieldStats>();

  for (const rule of candidateRules) {
    for (const condition of rule.conditions) {
      if (isKnown(known[condition.field])) {
        continue;
      }

      const existing = stats.get(condition.field) ?? { count: 0, values: new Set<string>() };
      existing.count += 1;
      existing.values.add(describeConditionValue(condition));
      stats.set(condition.field, existing);
    }
  }

  const scored = missingCandidates.map((field) => {
    const entry = stats.get(field);
    return { field, distinct: entry?.values.size ?? 0, count: entry?.count ?? 0 };
  });

  scored.sort((a, b) => {
    if (b.distinct !== a.distinct) {
      return b.distinct - a.distinct;
    }
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return defaultOrder.indexOf(a.field) - defaultOrder.indexOf(b.field);
  });

  const best = scored[0];

  if (!best) {
    const field = pickFallbackField(missingCandidates, defaultOrder);
    return { field, reason: 'fallback_no_missing_candidates' };
  }

  return {
    field: best.field,
    reason: `selected_distinct_${best.distinct}_count_${best.count}_from_${candidateRules.length}_rules`,
  };
}
