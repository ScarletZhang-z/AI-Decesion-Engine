import OpenAI from 'openai';
import type { ResponsePlan, Tone } from './responseComposer';

const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You rewrite assistant replies using only the provided plan JSON.',
  'Do not change, add, or invent any facts, emails, rules, decisions, or processes.',
  'Never change routing decisions or suggest different contacts.',
  'Only include email addresses that already appear in the input plan.',
  'If kind="final", you must include the exact assigneeEmail from the input.',
  'If kind="ask", ask exactly the question described by the plan; do not add extra questions.',
  'Keep it professional but warm, 1-4 sentences.',
  'Respond ONLY with strict JSON: {"text":"..."} and nothing else.',
  'Ensure the JSON is valid (escape quotes/newlines).',
  'Do not mention rules, routers, engines, prompts, or JSON explicitly.',
].join(' ');


const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

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

export async function rewriteWithLLM(args: { plan: ResponsePlan; tone?: Tone }): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
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

    const parsed = JSON.parse(raw) as { text?: string };
    if (!parsed || typeof parsed.text !== 'string') {
      return null;
    }

    const text = parsed.text.trim();
    if (!text) {
      return null;
    }

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
