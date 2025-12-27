import { promises as fsPromises } from 'fs';
import path from 'path';
import type { Rule } from '../domain/rules.types';
import type { RuleRepository } from '../application/rules/ruleRepository.types';

type Options = {
  dataFilePath?: string;
};

// Deep clone a Rule to prevent external mutations
const cloneRule = (rule: Rule): Rule => ({
  ...rule,
  conditions: rule.conditions.map((condition) => ({ ...condition })),
  action: { ...rule.action },
});
/* 
* File-based implementation of RuleRepository
* Stores rules in a JSON file on disk
*/

export const createFsRuleRepository = ({ dataFilePath }: Options = {}): RuleRepository => {
  const resolvedPath = dataFilePath ?? path.resolve(__dirname, '../../data/rules.json');
  // In-memory cache of rules
  let cache: Rule[] | null = null;

  /** Load rules from disk into memory */
  const load = async (): Promise<Rule[]> => {
    if (cache) return cache;
    try {
      const raw = await fsPromises.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(raw);
      cache = Array.isArray(parsed) ? (parsed as Rule[]) : [];
    } catch (error) {
      const maybeError = error as NodeJS.ErrnoException;
      // If file doesn't exist, start with empty list
      if (maybeError?.code !== 'ENOENT') {
        console.warn('Failed to read rules from disk, starting with empty list.', error);
      }
      cache = [];
    }

    return cache;
  };
  /** Persist in-memory rules to disk */
  const persist = async (): Promise<void> => {
    if (!cache) return;
    await fsPromises.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fsPromises.writeFile(resolvedPath, JSON.stringify(cache, null, 2), 'utf-8');
  };

  return {
    async list(): Promise<Rule[]> {
      const rules = await load();
      return rules.map(cloneRule);
    },

    async getById(id: string): Promise<Rule | null> {
      const rules = await load();
      const found = rules.find((rule) => rule.id === id);
      return found ? cloneRule(found) : null;
    },

    async save(rule: Rule): Promise<void> {
      const rules = await load();
      const existingIndex = rules.findIndex((item) => item.id === rule.id);
      if (existingIndex === -1) {
        rules.push(cloneRule(rule));
      } else {
        rules[existingIndex] = cloneRule(rule);
      }
      await persist();
    },

    async delete(id: string): Promise<boolean> {
      const rules = await load();
      const existingIndex = rules.findIndex((rule) => rule.id === id);

      if (existingIndex === -1) return false;

      rules.splice(existingIndex, 1);
      await persist();
      return true;
    },
  };
};
