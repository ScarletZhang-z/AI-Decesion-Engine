import type { Field } from '../../domain/rules';
import type { SessionState, ConversationHistoryEntry } from '../../domain/conversation';
import { normalizeContractType, normalizeDepartment, normalizeLocation } from '../normalizers';

const normalizeString = (value: string) => value.trim().toLowerCase();

const parseContractType = (message: string): string | null => {
  const normalized = normalizeString(message);

  const normalizedValue = normalizeContractType(message);
  return normalizedValue && normalizedValue.length <= 50 ? normalizedValue : null;
};

const parseLocation = (message: string): string | null => {
  const normalized = normalizeString(message).replace(/\./g, ' ');

  const normalizedValue = normalizeLocation(message);
  return normalizedValue && normalizedValue.length <= 50 ? normalizedValue : null;
};

const parseDepartment = (message: string): string | null => {
  const normalizedValue = normalizeDepartment(message);
  return normalizedValue && normalizedValue.length <= 80 ? normalizedValue : null;
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
  extractWithLLM(
    userMessage: string,
    options?: { history?: ConversationHistoryEntry[]; known?: Partial<SessionState> }
  ): Promise<Partial<SessionState>>;
};
