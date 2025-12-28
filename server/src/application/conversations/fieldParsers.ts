import type { Field } from '../../domain/rules.types';
import { parseField } from '../normalizers';

export const parseAnswerForField = (field: Field, message: string): string | null => {
  switch (field) {
    case 'contractType':
      return parseField(field, message);
    case 'location':
      return parseField(field, message);
    case 'department':
      return parseField(field, message);
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
