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
  const applyUpdate = <K extends keyof SessionState>(key: K) => {
    if (!(key in update)) return;

    const incoming = update[key];
    if (incoming === session[key]) return;

    if (incoming === null) {
      session[key] = null;
      return;
    }

    if (incoming === undefined) return;

    const normalized = typeof incoming === 'string' ? incoming.trim() : incoming;
    if (normalized !== session[key]) {
      session[key] = normalized as SessionState[K];
    }
  };

  applyUpdate('contractType');
  applyUpdate('location');
  applyUpdate('department');
  // console.log('session', session)
};
