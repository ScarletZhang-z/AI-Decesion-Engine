import type { Rule } from '../../domain/rules';

export interface RuleRepository {
  list(): Promise<Rule[]>;
  getById(id: string): Promise<Rule | null>;
  save(rule: Rule): Promise<void>;
  delete(id: string): Promise<boolean>;
}
