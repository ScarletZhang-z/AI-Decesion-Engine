import type { Conversation } from '../../domain/conversation';

export type ConversationRepository = {
  get(conversationId: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  create(conversationId?: string): Conversation;
  sweepExpired(): Promise<void>;
};
