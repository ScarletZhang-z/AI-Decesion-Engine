import { Field } from '../domain/rules';
import fs from 'fs';
import path from 'path';

type AliasConfig = Record<string, Record<string, string[]>>;

const aliasFilePath = path.resolve(__dirname, '../../data/fieldAliases.json');

let aliases: AliasConfig | null = null;

const loadAliases = (): AliasConfig => {
  if (aliases) return aliases;
  try {
    const raw = fs.readFileSync(aliasFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as AliasConfig;
    aliases = parsed;
    return parsed;
  } catch (error) {
    console.warn('Failed to load fieldAliases.json, falling back to built-in normalization', error);
    aliases = {};
    return {};
  }
};

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const matchAlias = (field: Field, value: string): string | null => {
  const config = loadAliases();
  const fieldAliases = config[field] ?? {};
  const normalized = value.trim().toLowerCase().replace(/\./g, ' ');

  for (const [canonical, variants] of Object.entries(fieldAliases)) {
    const normalizedVariants = variants.map((variant) => variant.trim().toLowerCase());
    if (normalizedVariants.some((variant) => normalized === variant || normalized.includes(variant))) {
      return canonical;
    }
  }

  return null;
};

export const normalizeContractType = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const alias = matchAlias('contractType', value);
  if (alias) return alias;
  return titleCase(value.trim());
};

export const normalizeLocation = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const alias = matchAlias('location', value);
  if (alias) return alias;
  return titleCase(value.trim());
};

export const normalizeDepartment = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const alias = matchAlias('department', value);
  if (alias) return alias;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return titleCase(trimmed);
};

export const normalizeField = (field: Field, value: string | null | undefined): string | null => {
  switch (field) {
    case 'contractType':
      return normalizeContractType(value);
    case 'location':
      return normalizeLocation(value);
    case 'department':
      return normalizeDepartment(value);
    default:
      return null;
  }
};
