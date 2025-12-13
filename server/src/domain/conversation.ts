import crypto from 'crypto';

export type ConversationHistoryEntry = { role: 'user' | 'assistant'; content: string; ts: number };

export type SessionState = {
  contractType: string | null;
  location: string | null;
  department: string | null;
};

export type PendingField = keyof SessionState | null;

export type Conversation = {
  id: string;
  sessionState: SessionState;
  pendingField: PendingField;
  history: ConversationHistoryEntry[];
  lastActiveAt: number;
};

export const createConversation = (conversationId?: string): Conversation => {
  const now = Date.now();
  return {
    id: conversationId || crypto.randomUUID(),
    sessionState: {
      contractType: null,
      location: null,
      department: null,
    },
    pendingField: null,
    history: [],
    lastActiveAt: now,
  };
};

export const appendHistory = (conversation: Conversation, entry: ConversationHistoryEntry): void => {
  conversation.history.push(entry);
  conversation.lastActiveAt = entry.ts;
};

export const updateSessionState = (session: SessionState, update: Partial<SessionState>): void => {
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
