import path from 'path';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import rulesRouter, { Field, Rule, getRules } from './routes/rules';
import conversationsRouter, {
  Conversation,
  ConversationHistoryEntry,
  createConversation,
  getConversation as loadConversation,
  saveConversation,
} from './routes/conversations';

// Load environment variables from the project root first, then allow local overrides in server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. LLM calls will fail.');
}

const app = express();
const port = Number.parseInt(process.env.PORT ?? '5000', 10);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api/rules', rulesRouter);
app.use('/api/conversations', conversationsRouter);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

type SessionState = Conversation['sessionState'];

const requiredFieldOrder: Field[] = ['contractType', 'location', 'department'];

const normalizeString = (value: string) => value.trim().toLowerCase();

const parseContractType = (message: string): string | null => {
  const normalized = normalizeString(message);

  if (/\bnda\b|\bnon[-\s]?disclosure\b|confidentiality/.test(normalized)) {
    return 'NDA';
  }
  if (/(employment|employee|hiring|hire|job offer|hr)/.test(normalized)) {
    return 'Employment';
  }
  if (/(sales|sale|sell|commercial|deal|revenue)/.test(normalized)) {
    return 'Sales';
  }

  return null;
};

const parseLocation = (message: string): string | null => {
  const normalized = normalizeString(message);

  if (/\baustralia\b|\bau\b/.test(normalized)) {
    return 'Australia';
  }
  if (/\b(united states|usa|us|america)\b/.test(normalized)) {
    return 'United States';
  }

  return null;
};

const parseDepartment = (message: string): string | null => {
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseAnswerForField = (field: Field, message: string): string | null => {
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

const chooseNextField = (missingFields: Field[]): Field | null => {
  for (const field of requiredFieldOrder) {
    if (missingFields.includes(field)) {
      return field;
    }
  }
  return null;
};

const questionForField = (field: Field): string => {
  switch (field) {
    case 'contractType':
      return '这是 Sales、Employment 还是 NDA？';
    case 'location':
      return '你目前在哪个国家/地区？';
    case 'department':
      return '你所在的部门是？';
    default:
      return '请提供更多信息。';
  }
};

const extractFieldsWithLLM = async (userMessage: string): Promise<Partial<SessionState>> => {
  if (!process.env.OPENAI_API_KEY) {
    return {};
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

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
};

const collectRequiredFields = (rules: Rule[]): Set<Field> => {
  const required = new Set<Field>();
  for (const rule of rules) {
    for (const condition of rule.conditions) {
      required.add(condition.field);
    }
  }
  return required;
};

const updateSessionState = (session: SessionState, update: Partial<SessionState>) => {
  if (update.contractType !== undefined && update.contractType !== session.contractType && update.contractType !== null) {
    session.contractType = update.contractType;
  }
  if (update.location !== undefined && update.location !== session.location && update.location !== null) {
    session.location = update.location;
  }
  if (update.department !== undefined && update.department !== session.department && update.department !== null) {
    session.department = update.department.trim();
  }
};

const appendHistory = (conversation: Conversation, entry: ConversationHistoryEntry) => {
  conversation.history.push(entry);
  conversation.lastActiveAt = entry.ts;
};

const matchRule = (rules: Rule[], session: SessionState): Rule | undefined =>
  rules.find((rule) => rule.conditions.every((condition) => session[condition.field] === condition.value));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req: Request, res: Response) => {
  const { conversationId: incomingConversationId, userMessage } = req.body ?? {};

  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    res.status(400).json({ error: 'userMessage is required' });
    return;
  }

  const trimmedMessage = userMessage.trim();
  const now = Date.now();

  let conversation: Conversation | null = null;
  if (typeof incomingConversationId === 'string' && incomingConversationId.trim()) {
    conversation = await loadConversation(incomingConversationId.trim());
  }
  if (!conversation) {
    conversation = createConversation(typeof incomingConversationId === 'string' && incomingConversationId.trim() ? incomingConversationId.trim() : undefined);
  }

  appendHistory(conversation, { role: 'user', content: trimmedMessage, ts: now });

  const activeRules = getRules()
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.priority - a.priority);
  const requiredFields = collectRequiredFields(activeRules);

  let parsedFromPending = false;
  if (conversation.pendingField) {
    const parsedValue = parseAnswerForField(conversation.pendingField, trimmedMessage);
    if (parsedValue !== null) {
      conversation.sessionState[conversation.pendingField] = parsedValue;
      conversation.pendingField = null;
      parsedFromPending = true;
    }
  }

  if (conversation.pendingField === null || !parsedFromPending) {
    const extracted = await extractFieldsWithLLM(trimmedMessage);
    updateSessionState(conversation.sessionState, extracted);
  }

  const matched = matchRule(activeRules, conversation.sessionState);

  let responseText: string;

  if (matched) {
    responseText = `请联系 ${matched.assigneeEmail} 处理你的请求。`;
    conversation.pendingField = null;
  } else {
    const missingFields = Array.from(requiredFields).filter((field) => conversation.sessionState[field] === null);

    if (missingFields.length > 0) {
      const nextField = chooseNextField(missingFields);
      if (nextField) {
        conversation.pendingField = nextField;
        responseText = questionForField(nextField);
      } else {
        responseText = '我暂时找不到匹配的规则，请联系 legal@acme.corp。';
        conversation.pendingField = null;
      }
    } else {
      responseText = '我暂时找不到匹配的规则，请联系 legal@acme.corp。';
      conversation.pendingField = null;
    }
  }

  appendHistory(conversation, { role: 'assistant', content: responseText, ts: Date.now() });

  try {
    await saveConversation(conversation);
  } catch (error) {
    console.error('Failed to persist conversation', error);
  }

  res.json({ conversationId: conversation.id, response: responseText });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
