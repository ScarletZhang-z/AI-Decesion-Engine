import OpenAI from 'openai';
import type { SessionState } from '../../domain/conversation';
import { FieldExtractor } from './fieldParsers';

export const createLLMFieldExtractor = (openai: OpenAI): FieldExtractor => {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  return {
    async extractWithLLM(userMessage: string): Promise<Partial<SessionState>> {
      if (!process.env.OPENAI_API_KEY) {
        return {};
      }

      try {
        const completion = await openai.chat.completions.create({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You extract structured fields for a legal triage assistant. Respond ONLY with JSON matching: {"contractType": "Sales" | "Employment" | "NDA" | null, "location": "Australia" | "United States" | null, "department": string | null}. Use null when unsure.',
            },
            { role: 'user', content: userMessage },
          ],
        });

        const raw = completion.choices[0]?.message?.content ?? '';
        if (!raw) {
          return {};
        }

        const parsed = JSON.parse(raw) as Partial<SessionState>;
        const result: Partial<SessionState> = {};

        if (parsed.contractType === 'Sales' || parsed.contractType === 'Employment' || parsed.contractType === 'NDA') {
          result.contractType = parsed.contractType;
        } else if (parsed.contractType === null) {
          result.contractType = null;
        }

        if (parsed.location === 'Australia' || parsed.location === 'United States') {
          result.location = parsed.location;
        } else if (parsed.location === null) {
          result.location = null;
        }

        if (typeof parsed.department === 'string') {
          result.department = parsed.department.trim() || null;
        } else if (parsed.department === null) {
          result.department = null;
        }

        return result;
      } catch (error) {
        console.error('Failed to extract fields with LLM', error);
        return {};
      }
    },
  };
};
