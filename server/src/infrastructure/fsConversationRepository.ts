import path from 'path';
import { promises as fs } from 'fs';
import { Conversation, ConversationHistoryEntry, PendingField, createConversation } from '../domain/conversation';
import type { ConversationRepository } from '../application/conversations/conversationRepository';

const conversationsDir = path.resolve(__dirname, '../../data/conversations');
const EXPIRY_MS = 30 * 60 * 1000;

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

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

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
    pendingField: pendingField as PendingField,
    history: history as ConversationHistoryEntry[],
    lastActiveAt,
  };
};

const ensureConversationsDir = async () => {
  // Create the conversations directory if it doesn't exist.
  // Recursive mode avoids errors when the directory already exists
  // and creates parent directories as needed.
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

export const createFsConversationRepository = (): ConversationRepository => {
  const conversations = new Map<string, Conversation>();

  const getFromMemoryOrFile = async (conversationId: string): Promise<Conversation | null> => {
    if (conversations.has(conversationId)) {
      return conversations.get(conversationId) ?? null;
    }

    const loaded = await loadConversationFromFile(conversationId);
    if (loaded) {
      conversations.set(conversationId, loaded);
    }

    return loaded;
  };

  // Periodically remove expired conversations from memory.
  // Persist the conversation to disk before eviction to avoid data loss.
  const sweepExpired = async () => {
    const now = Date.now();

    for (const [id, conversation] of conversations.entries()) {
      if (now - conversation.lastActiveAt > EXPIRY_MS) {
        try {
          await persistConversation(conversation);
        } catch (error) {
          console.error(`Failed to persist conversation ${id} before eviction`, error);
        }
        conversations.delete(id);
      }
    }
  };

  return {
    async get(conversationId: string) {
      return getFromMemoryOrFile(conversationId);
    },
    async save(conversation: Conversation) {
      conversations.set(conversation.id, conversation);
      await persistConversation(conversation);
    },
    create: (conversationId?: string) => createConversation(conversationId),
    sweepExpired,
  };
};
