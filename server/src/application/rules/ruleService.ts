import crypto from 'crypto';
import type { Condition, Field, Operator, Rule } from '../../domain/rules.types';
import type { RuleRepository } from './ruleRepository.types';

const allowedFields: ReadonlySet<Field> = new Set<Field>(['contractType', 'location', 'department']);
const allowedOperators: ReadonlySet<Operator> = new Set<Operator>(['eq']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RulePatchInput = Record<string, unknown>;

type ValidationResult = { ok: true; value: Rule } | { ok: false; message: string };

type ServiceError = 'validation' | 'not_found';

export type RuleResult =
  | { ok: true; rule: Rule }
  | { ok: false; error: ServiceError; message: string };

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: 'not_found'; message: string };

const validateConditions = (input: unknown): { ok: true; value: Condition[] } | { ok: false; message: string } => {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, message: 'conditions must be a non-empty array' };
  }

  const sanitized: Condition[] = [];

  for (const [index, raw] of input.entries()) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, message: `condition at index ${index} is invalid` };
    }

    const maybeCondition = raw as Record<string, unknown>;
    const field = maybeCondition.field;
    const op = maybeCondition.op;
    const value = maybeCondition.value;

    if (typeof field !== 'string' || !allowedFields.has(field as Field)) {
      return { ok: false, message: `condition.field at index ${index} must be one of: ${Array.from(allowedFields).join(', ')}` };
    }

    if (typeof op !== 'string' || !allowedOperators.has(op as Operator)) {
      return { ok: false, message: `condition.op at index ${index} must be one of: ${Array.from(allowedOperators).join(', ')}` };
    }

    if (typeof value !== 'string' || !value.trim()) {
      return { ok: false, message: `condition.value at index ${index} must be a non-empty string` };
    }

    sanitized.push({ field: field as Field, op: 'eq', value: value.trim() });
  }

  return { ok: true, value: sanitized };
};

const isValidEmail = (input: unknown): input is string => typeof input === 'string' && EMAIL_REGEX.test(input);

const validateRulePatch = (payload: RulePatchInput, current?: Rule): ValidationResult => {
  const next: Rule = current
    ? { ...current }
    : {
        id: crypto.randomUUID(),
        enabled: true,
        priority: 0,
        conditions: [],
        action: { type: 'assign_email', value: '' },
      };

  if ('name' in payload) {
    if (payload.name == null) {
      delete next.name;
    } else if (typeof payload.name !== 'string' || !payload.name.trim()) {
      return { ok: false, message: 'name must be a non-empty string when provided' };
    } else {
      next.name = payload.name.trim();
    }
  }

  if ('enabled' in payload) {
    if (typeof payload.enabled !== 'boolean') {
      return { ok: false, message: 'enabled must be a boolean' };
    }
    next.enabled = payload.enabled;
  } else if (!current) {
    next.enabled = true;
  }

  if ('priority' in payload) {
    const numericPriority = typeof payload.priority === 'number' ? payload.priority : Number(payload.priority);
    if (!Number.isFinite(numericPriority)) {
      return { ok: false, message: 'priority must be a finite number' };
    }
    next.priority = numericPriority;
  } else if (!current) {
    next.priority = 0;
  }

  if ('conditions' in payload) {
    const conditionsValidation = validateConditions(payload.conditions);
    if (!conditionsValidation.ok) {
      return { ok: false, message: conditionsValidation.message };
    }
    next.conditions = conditionsValidation.value;
  } else if (!current) {
    return { ok: false, message: 'conditions are required' };
  }

  if ('action' in payload) {
    const actionPayload = payload.action as Record<string, unknown>;
    if (!actionPayload || typeof actionPayload !== 'object') {
      return { ok: false, message: 'action must be an object' };
    }

    if (actionPayload.type !== 'assign_email') {
      return { ok: false, message: 'action.type must be \"assign_email\"' };
    }

    if (!isValidEmail(actionPayload.value)) {
      return { ok: false, message: 'action.value must be a valid email' };
    }

    next.action = { type: 'assign_email', value: (actionPayload.value as string).trim() };
  } else if (!current) {
    return { ok: false, message: 'action is required' };
  }

  return { ok: true, value: next };
};

export const createRuleService = ({ repository }: { repository: RuleRepository }) => {
  return {
    async list(): Promise<Rule[]> {
      return repository.list();
    },

    async create(payload: RulePatchInput): Promise<RuleResult> {
      const result = validateRulePatch(payload);
      if (!result.ok) {
        return { ok: false, error: 'validation', message: result.message };
      }

      await repository.save(result.value);
      return { ok: true, rule: result.value };
    },

    async update(id: string, payload: RulePatchInput): Promise<RuleResult> {
      const current = await repository.getById(id);
      if (!current) {
        return { ok: false, error: 'not_found', message: 'Rule not found' };
      }

      const result = validateRulePatch(payload, current);
      if (!result.ok) {
        return { ok: false, error: 'validation', message: result.message };
      }

      await repository.save(result.value);
      return { ok: true, rule: result.value };
    },

    async remove(id: string): Promise<DeleteResult> {
      const deleted = await repository.delete(id);
      if (!deleted) {
        return { ok: false, error: 'not_found', message: 'Rule not found' };
      }
      return { ok: true };
    },
  };
};

export type RuleService = ReturnType<typeof createRuleService>;
