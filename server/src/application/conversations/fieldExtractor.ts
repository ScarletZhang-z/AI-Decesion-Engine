import type { ConversationHistoryEntry, SessionState } from '../../domain/conversation';

export type FieldExtractor = {
  extractWithLLM(
    userMessage: string,
    options?: { history?: ConversationHistoryEntry[]; known?: Partial<SessionState> }
  ): Promise<Partial<SessionState>>;
};
