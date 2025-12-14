import OpenAI from 'openai';
import type { ConversationHistoryEntry, SessionState } from '../../domain/conversation';
import { normalizeContractType, normalizeDepartment, normalizeLocation } from '../normalizers';
import { FieldExtractor } from './fieldParsers';

export const createLLMFieldExtractor = (openai: OpenAI): FieldExtractor => {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const SYSTEM_PROMPT =
    'You extract structured fields for a legal triage assistant. Use the most recent conversation context to infer values. ' +
    'Always respond ONLY with JSON exactly matching: {"contractType": string|null, "location": string|null, "department": string|null}. ' +
    'Prefer concise canonical values (e.g. "Sales", "Employment", "NDA", "Australia", "United States"). ' +
    'If the value is unclear, return null. Never invent emails, steps, or extra keys.';

  const buildUserPayload = (userMessage: string, history: ConversationHistoryEntry[], known: Partial<SessionState>) => ({
    message: userMessage,
    known,
    recentHistory: history.slice(-6).map((item) => ({ role: item.role, content: item.content })),
    instructions:
      'Fill only fields you are confident about based on the conversation. Prefer country for location; prefer contract type/category for contractType; keep department short (e.g. Engineering, Marketing).',
  });

  return {
    async extractWithLLM(
      userMessage: string,
      options?: { history?: ConversationHistoryEntry[]; known?: Partial<SessionState> }
    ): Promise<Partial<SessionState>> {
      if (!process.env.OPENAI_API_KEY) {
        return {};
      }

      const history = options?.history ?? [];
      const known = options?.known ?? {};

      try {
        const completion = await openai.chat.completions.create({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            { role: 'user', content: JSON.stringify(buildUserPayload(userMessage, history, known)) },
          ],
          temperature: 0.3,
        });

        const raw = completion.choices[0]?.message?.content ?? '';
        if (!raw) {
          return {};
        }

        const parsed = JSON.parse(raw) as Partial<SessionState>;
        const result: Partial<SessionState> = {};

        const contractType = normalizeContractType(parsed.contractType);
        const location = normalizeLocation(parsed.location);
        const department = normalizeDepartment(parsed.department);

        if (contractType !== undefined) {
          result.contractType = contractType ?? null;
        }

        if (location !== undefined) {
          result.location = location ?? null;
        }

        if (department !== undefined) {
          result.department = department ?? null;
        }

        return result;
      } catch (error) {
        console.error('Failed to extract fields with LLM', error);
        return {};
      }
    },
  };
};
