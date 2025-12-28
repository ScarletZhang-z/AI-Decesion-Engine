import type { ResponsePlan, Tone } from './responseComposer';
import { openai } from '../infrastructure/openaiClient';

const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are a professional response writer for a legal triage assistant.
  Your task: Rewrite assistant replies based ONLY on the provided response plan.
  CRITICAL RULES:
  - Never change, add, or invent any facts, emails, or decisions
  - Never modify routing decisions or suggest different contacts
  - Only include email addresses that appear in the input plan
  - If kind="final": MUST include the exact assigneeEmail from the plan
  - If kind="ask": Ask exactly the question described; no extra questions
  - Keep responses professional but warm, 1-4 sentences maximum
  - Do not mention: rules, routers, engines, prompts, or JSON

  Output format: {"text": "your rewritten response"}
  Ensure valid JSON (escape quotes and newlines properly).`;


const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const extractEmails = (text: string): string[] => Array.from(text.match(emailRegex) ?? []);

const validateFinal = (text: string, assigneeEmail: string): boolean => {
  if (!text.includes(assigneeEmail)) {
    return false;
  }

  const emails = extractEmails(text).filter((email) => email.toLowerCase() !== assigneeEmail.toLowerCase());
  return emails.length === 0;
};

const validateAsk = (text: string): boolean => text.includes('?') || text.trim().endsWith('?');

const validateFallback = (text: string, fallbackEmail: string): boolean => {
  const emails = extractEmails(text);
  if (emails.length === 0) {
    return true;
  }
  return emails.every((email) => email.toLowerCase() === fallbackEmail.toLowerCase());
};

const RESPONSE_SCHEMA = { 
    name: "rewrite_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        text: { 
          type: "string",
          description: "The rewritten assistant reply"
        }
      },
      required: ["text"],
      additionalProperties: false
    }
} as const;

export async function rewriteWithLLM(args: { plan: ResponsePlan; tone?: Tone | null }): Promise<string | null> {

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ plan: args.plan, tone: args.tone ?? null }) },
      ],
      temperature: 0.6,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { text: string };
    const text = parsed.text.trim();

    if (args.plan.kind === 'final') {
      return validateFinal(text, args.plan.assigneeEmail) ? text : null;
    }

    if (args.plan.kind === 'ask') {
      return validateAsk(text) ? text : null;
    }

    if (args.plan.kind === 'fallback') {
      return validateFallback(text, args.plan.fallbackEmail) ? text : null;
    }

    return null;
  } catch (error) {
    console.error('LLM copywriter failed', error);
    return null;
  }
}
