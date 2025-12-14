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
      return 'Is this Sales, Employment, or NDA?';
    case 'location':
      return 'Which country or region are you currently in?';
    case 'department':
      return 'Which department are you in?';
    default:
      return 'Please provide more information.';
  }
};

export type FieldExtractor = {
  extractWithLLM(userMessage: string): Promise<Partial<SessionState>>;
};
