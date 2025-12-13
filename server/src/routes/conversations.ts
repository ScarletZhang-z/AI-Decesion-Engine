import path from 'path';
import { promises as fs } from 'fs';
import { Router, Request, Response } from 'express';

type ConversationHistoryEntry = { role: 'user' | 'assistant'; content: string; ts: number };

type Conversation = {
  id: string;
  sessionState: {
    contractType: string | null;
    location: string | null;
    department: string | null;
  };
  pendingField: 'contractType' | 'location' | 'department' | null;
  history: ConversationHistoryEntry[];
  lastActiveAt: number;
};

const router = Router();
const conversations = new Map<string, Conversation>();
const conversationsDir = path.resolve(__dirname, '../../data/conversations');

const isHistoryEntry = (entry: unknown): entry is ConversationHistoryEntry => {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  const candidate = entry as Record<string, unknown>;
  const role = candidate.role;
  const content = candidate.content;
  const ts = candidate.ts;

  const validRole = role === 'user' || role === 'assistant';
  const validContent = typeof content === 'string';
  const validTs = typeof ts === 'number' && Number.isFinite(ts);

  return validRole && validContent && validTs;
};

const parseConversation = (data: unknown): Conversation | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidate = data as Record<string, unknown>;

  const id = candidate.id;
  const sessionState = candidate.sessionState;
  const pendingField = candidate.pendingField;
  const history = candidate.history;
  const lastActiveAt = candidate.lastActiveAt;

  if (typeof id !== 'string') return null;
  if (!sessionState || typeof sessionState !== 'object') return null;

  const sessionStateRecord = sessionState as Record<string, unknown>;
  const contractType = sessionStateRecord.contractType;
  const location = sessionStateRecord.location;
  const department = sessionStateRecord.department;

  const isNullableString = (value: unknown): value is string | null =>
    value === null || typeof value === 'string';

  if (!isNullableString(contractType) || !isNullableString(location) || !isNullableString(department)) {
    return null;
  }

  const validPendingField =
    pendingField === null || pendingField === 'contractType' || pendingField === 'location' || pendingField === 'department';
  if (!validPendingField) return null;

  if (!Array.isArray(history) || history.some((entry) => !isHistoryEntry(entry))) {
    return null;
  }

  if (typeof lastActiveAt !== 'number' || !Number.isFinite(lastActiveAt)) {
    return null;
  }

  return {
    id,
    sessionState: {
      contractType: contractType ?? null,
      location: location ?? null,
      department: department ?? null,
    },
    pendingField: pendingField as Conversation['pendingField'],
    history: history as ConversationHistoryEntry[],
    lastActiveAt,
  };
};

const ensureConversationsDir = async () => {
  await fs.mkdir(conversationsDir, { recursive: true });
};

const loadConversationFromFile = async (conversationId: string): Promise<Conversation | null> => {
  const filePath = path.join(conversationsDir, `${conversationId}.json`);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parseConversation(parsed);
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError?.code === 'ENOENT') {
      return null;
    }
    console.error(`Failed to read conversation file: ${filePath}`, error);
    throw error;
  }
};

const persistConversation = async (conversation: Conversation): Promise<void> => {
  await ensureConversationsDir();
  const filePath = path.join(conversationsDir, `${conversation.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
};

export const getConversation = async (conversationId: string): Promise<Conversation | null> => {
  if (conversations.has(conversationId)) {
    return conversations.get(conversationId) ?? null;
  }

  const loaded = await loadConversationFromFile(conversationId);
  if (loaded) {
    conversations.set(conversationId, loaded);
  }

  return loaded;
};

export const saveConversation = async (conversation: Conversation): Promise<void> => {
  conversations.set(conversation.id, conversation);
  await persistConversation(conversation);
};

router.get('/:id', async (req: Request, res: Response) => {
  const conversationId = req.params.id;

  try {
    const conversation = await getConversation(conversationId);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ conversationId: conversation.id, history: conversation.history });
  } catch (error) {
    console.error('Failed to load conversation', error);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

export default router;
