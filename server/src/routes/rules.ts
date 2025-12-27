import crypto from 'crypto';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import type { Condition, Field, Operator, Rule } from '../domain/rules';
import { toRuleListResponseDTO, toRuleRequestDTO, toRuleResponseDTO } from '../interfaces/http/dto/rules';
export type { Condition, Field, Rule } from '../domain/rules';

const router = Router();

const dataFilePath = path.resolve(__dirname, '../../data/rules.json');
const allowedFields: ReadonlySet<Field> = new Set<Field>(['contractType', 'location', 'department']);
const allowedOperators: ReadonlySet<Operator> = new Set<Operator>(['eq']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let rules: Rule[] = [];

const readInitialRules = (): void => {
  try {
    const raw = fs.readFileSync(dataFilePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      rules = parsed as Rule[];
    } else {
      rules = [];
    }
  } catch (error: unknown) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError?.code !== 'ENOENT') {
      console.warn('Failed to read rules.json, starting with empty rules list.', error);
    }

    rules = [];
  }
};

const persistRules = async (): Promise<void> => {
  await fsPromises.mkdir(path.dirname(dataFilePath), { recursive: true });
  await fsPromises.writeFile(dataFilePath, JSON.stringify(rules, null, 2), 'utf-8');
};

export const getRules = (): Rule[] => rules;

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

const validateRulePatch = (payload: ReturnType<typeof toRuleRequestDTO>, current?: Rule) => {
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
      return { ok: false, message: 'name must be a non-empty string when provided' } as const;
    } else {
      next.name = payload.name.trim();
    }
  }

  if ('enabled' in payload) {
    if (typeof payload.enabled !== 'boolean') {
      return { ok: false, message: 'enabled must be a boolean' } as const;
    }
    next.enabled = payload.enabled;
  } else if (!current) {
    next.enabled = true;
  }

  if ('priority' in payload) {
    const numericPriority = typeof payload.priority === 'number' ? payload.priority : Number(payload.priority);
    if (!Number.isFinite(numericPriority)) {
      return { ok: false, message: 'priority must be a finite number' } as const;
    }
    next.priority = numericPriority;
  } else if (!current) {
    next.priority = 0;
  }

  if ('conditions' in payload) {
    const conditionsValidation = validateConditions(payload.conditions);
    if (!conditionsValidation.ok) {
      return { ok: false, message: conditionsValidation.message } as const;
    }
    next.conditions = conditionsValidation.value;
  } else if (!current) {
    return { ok: false, message: 'conditions are required' } as const;
  }

  if ('action' in payload) {
    const actionPayload = payload.action as Record<string, unknown>;
    if (!actionPayload || typeof actionPayload !== 'object') {
      return { ok: false, message: 'action must be an object' } as const;
    }

    if (actionPayload.type !== 'assign_email') {
      return { ok: false, message: 'action.type must be "assign_email"' } as const;
    }

    if (!isValidEmail(actionPayload.value)) {
      return { ok: false, message: 'action.value must be a valid email' } as const;
    }

    next.action = { type: 'assign_email', value: (actionPayload.value as string).trim() };
  } else if (!current) {
    return { ok: false, message: 'action is required' } as const;
  }

  return { ok: true, value: next } as const;
};

readInitialRules();

router.get('/', (_req: Request, res: Response) => {
  res.json(toRuleListResponseDTO(rules));
});

router.post('/', async (req: Request, res: Response) => {
  const payload = toRuleRequestDTO(req.body);
  const result = validateRulePatch(payload);

  if (!result.ok) {
    res.status(400).json({ error: result.message });
    return;
  }

  rules.push(result.value);

  try {
    await persistRules();
    res.status(201).json(toRuleResponseDTO(result.value));
  } catch (error) {
    console.error('Failed to persist rules after create', error);
    res.status(500).json({ error: 'Failed to save rule' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const existingIndex = rules.findIndex((rule) => rule.id === id);

  if (existingIndex === -1) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }

  const payload = toRuleRequestDTO(req.body);
  const result = validateRulePatch(payload, rules[existingIndex]);

  if (!result.ok) {
    res.status(400).json({ error: result.message });
    return;
  }

  rules[existingIndex] = result.value;

  try {
    await persistRules();
    res.json(toRuleResponseDTO(result.value));
  } catch (error) {
    console.error('Failed to persist rules after update', error);
    res.status(500).json({ error: 'Failed to save rule' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const existingIndex = rules.findIndex((rule) => rule.id === id);

  if (existingIndex === -1) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }

  rules.splice(existingIndex, 1);

  try {
    await persistRules();
    res.status(204).send();
  } catch (error) {
    console.error('Failed to persist rules after delete', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
