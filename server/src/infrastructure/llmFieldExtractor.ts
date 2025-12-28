import type { ConversationHistoryEntry, SessionState } from '../domain/conversation';
import { normalizeContractType, normalizeDepartment, normalizeLocation } from '../application/normalizers';
import type { FieldExtractor } from '../application/conversations/fieldExtractor.types';
import { openai } from './openaiClient';

export const createLLMFieldExtractor = (): FieldExtractor => {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const SYSTEM_PROMPT = `You are a field extraction assistant for a legal triage system.
    Your task: Extract contractType, location, and department from conversations.
    Rules:
    - Use ONLY the most recent conversation context
    - Return canonical values (e.g., "Employment", "NDA", "Sales", "Australia")
    - Use null for unclear values
    - NEVER invent information
    Output format: {"contractType": string|null, "location": string|null, "department": string|null}`;

  const buildUserPayload = (userMessage: string, history: ConversationHistoryEntry[], known: Partial<SessionState>) => ({
    message: userMessage,
    known,
    recentHistory: history.slice(-6).map((item) => ({ role: item.role, content: item.content })),
    instructions:
      'Fill only fields you are confident about based on the conversation. Prefer country for location; prefer contract type/category for contractType; keep department short (e.g. Engineering, Marketing).',
  });

  const RESPONSE_SCHEMA = {
    name: 'TriageFields',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        contractType: { 
        type: ['string', 'null'],
        description: 'Type of contract (e.g., Employment, NDA, Service Agreement)'
        },
        location: { 
          type: ['string', 'null'],
          description: 'Country or jurisdiction (e.g., Australia, United States)'
        },
        department: { 
          type: ['string', 'null'],
          description: 'Department name (e.g., Sales, Engineering, HR)'
        },
      },
      required: ['contractType', 'location', 'department'],
      additionalProperties: false,
    },
  } as const;

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
          response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            { role: 'user', content: JSON.stringify(buildUserPayload(userMessage, history, known)) },
          ],
          temperature: 0,
        });

        const raw = completion.choices[0]?.message?.content ?? '';

        if (!raw) {
          return {};
        }

        // console.log('LLM raw response:', completion.choices);

        const parsed = JSON.parse(raw) as Partial<SessionState>;

        const result: Partial<SessionState> = {};

        result.contractType = normalizeContractType(parsed.contractType);
        result.location = normalizeLocation(parsed.location);
        result.department = normalizeDepartment(parsed.department);

        return result;
      } catch (error) {
        console.error('Failed to extract fields with LLM', error);
        return {};
      }
    },
  };
};
