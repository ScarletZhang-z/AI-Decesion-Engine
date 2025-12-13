import type { ChatCommand, ChatResponseDTO } from '../../interfaces/http/dto/chat';
import type { Field } from '../../domain/rules';
import type { Router as RuleRouter } from '../routing/ruleRouter';
import { Conversation, appendHistory, updateSessionState } from '../../domain/conversation';
import { chooseNextField, parseAnswerForField, questionForField, FieldExtractor } from './fieldParsers';
import type { ConversationRepository } from './conversationRepository';

type Dependencies = {
  conversationRepository: ConversationRepository;
  ruleRouter: RuleRouter;
  fieldExtractor: FieldExtractor;
  requiredFieldOrder?: Field[];
};

const DEFAULT_REQUIRED_FIELD_ORDER: Field[] = ['contractType', 'location', 'department'];

export const createChatService = ({
  conversationRepository,
  ruleRouter,
  fieldExtractor,
  requiredFieldOrder = DEFAULT_REQUIRED_FIELD_ORDER,
}: Dependencies) => ({
  async handle(command: ChatCommand): Promise<ChatResponseDTO> {
    const { conversationId: incomingConversationId, userMessage } = command;

    const trimmedMessage = userMessage.trim();
    const now = Date.now();

    const incomingId = typeof incomingConversationId === 'string' && incomingConversationId.trim() ? incomingConversationId.trim() : undefined;

    let conversation: Conversation | null = null;
    if (incomingId) {
      conversation = await conversationRepository.get(incomingId);
    }
    if (!conversation) {
      conversation = conversationRepository.create(incomingId);
    }

    appendHistory(conversation, { role: 'user', content: trimmedMessage, ts: now });

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
      const extracted = await fieldExtractor.extractWithLLM(trimmedMessage);
      updateSessionState(conversation.sessionState, extracted);
    }

    const ruleResult = await ruleRouter.route({ sessionState: conversation.sessionState });

    let responseText: string;

    if (ruleResult.status === 'matched') {
      responseText = `请联系 ${ruleResult.assigneeEmail} 处理你的请求。`;
      conversation.pendingField = null;
    } else {
      const missingFields = ruleResult.status === 'missing_fields' ? ruleResult.fields : [];

      if (missingFields.length > 0) {
        const nextField = chooseNextField(missingFields, requiredFieldOrder);
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
      await conversationRepository.save(conversation);
    } catch (error) {
      console.error('Failed to persist conversation', error);
    }

    return { conversationId: conversation.id, response: responseText };
  },
});
