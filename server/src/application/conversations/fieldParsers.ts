import type { Field } from '../../domain/rules';
import type { SessionState } from '../../domain/conversation';

const normalizeString = (value: string) => value.trim().toLowerCase();

const parseContractType = (message: string): string | null => {
  const normalized = normalizeString(message);

  if (/\bnda\b|\bnon[-\s]?disclosure\b|confidentiality/.test(normalized)) {
    return 'NDA';
  }
  if (/(employment|employee|hiring|hire|job offer|hr)/.test(normalized)) {
    return 'Employment';
  }
  if (/(sales|sale|sell|commercial|deal|revenue)/.test(normalized)) {
    return 'Sales';
  }

  return null;
};

const parseLocation = (message: string): string | null => {
  const normalized = normalizeString(message);

  if (/\baustralia\b|\bau\b/.test(normalized)) {
    return 'Australia';
  }
  if (/\b(united states|usa|us|america)\b/.test(normalized)) {
    return 'United States';
  }

  return null;
};

const parseDepartment = (message: string): string | null => {
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const parseAnswerForField = (field: Field, message: string): string | null => {
  switch (field) {
    case 'contractType':
      return parseContractType(message);
    case 'location':
      return parseLocation(message);
    case 'department':
      return parseDepartment(message);
    default:
      return null;
  }
};

export const chooseNextField = (missingFields: Field[], requiredOrder: Field[]): Field | null => {
  for (const field of requiredOrder) {
    if (missingFields.includes(field)) {
      return field;
    }
  }
  return null;
};

export const questionForField = (field: Field): string => {
  switch (field) {
    case 'contractType':
      return '这是 Sales、Employment 还是 NDA？';
    case 'location':
      return '你目前在哪个国家/地区？';
    case 'department':
      return '你所在的部门是？';
    default:
      return '请提供更多信息。';
  }
};

export type FieldExtractor = {
  extractWithLLM(userMessage: string): Promise<Partial<SessionState>>;
};
