import type { ChatCommand, ChatResponseDTO } from '../../interfaces/http/dto/chat';
import type { Field } from '../../domain/rules';
import type { Router as RuleRouter } from '../routing/ruleRouter';
import { Conversation, appendHistory, updateSessionState } from '../../domain/conversation';
import type { FieldExtractor } from './fieldParsers';
import { parseAnswerForField } from './fieldParsers';
import { selectNextField } from '../nextQuestionSelector';
import { composePlan } from '../responseComposer';
import type { FieldName } from '../responseComposer';
import { rewriteWithLLM } from '../llmCopywriter';
import type { ConversationRepository } from './conversationRepository';

type Dependencies = {
  conversationRepository: ConversationRepository;
  ruleRouter: RuleRouter;
  fieldExtractor: FieldExtractor;
  requiredFieldOrder?: Field[];
};

const DEFAULT_REQUIRED_FIELD_ORDER: Field[] = ['contractType', 'location', 'department'];
const FALLBACK_EMAIL = process.env.FALLBACK_EMAIL ?? 'legal@acme.corp';

const buildAskFields = (missingFields: Field[], requiredFieldOrder: Field[], preferred?: Field | null): Field[] => {
  const prioritized: Field[] = [];
  if (preferred && missingFields.includes(preferred)) {
    prioritized.push(preferred);
  }

  const orderedMissing = requiredFieldOrder.filter((field) => missingFields.includes(field));
  for (const field of orderedMissing) {
    if (!prioritized.includes(field)) {
      prioritized.push(field);
    }
  }

  for (const field of missingFields) {
    if (!prioritized.includes(field)) {
      prioritized.push(field);
    }
  }

  return prioritized.slice(0, 2);
};

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
      const extracted = await fieldExtractor.extractWithLLM(trimmedMessage, {
        history: conversation.history,
        known: conversation.sessionState,
      });
      updateSessionState(conversation.sessionState, extracted);
    }

    const ruleResult = await ruleRouter.route({ sessionState: conversation.sessionState });

    let askFields: Field[] = [];
    let assigneeEmail: string | null = null;

    if (ruleResult.status === 'matched') {
      assigneeEmail = ruleResult.assigneeEmail;
      conversation.pendingField = null;
    } else if (ruleResult.status === 'missing_fields') {
      const missingFields = ruleResult.fields ?? [];
      const selection =
        Array.isArray(ruleResult.rules) && ruleResult.rules.length > 0
          ? selectNextField({ known: conversation.sessionState, rules: ruleResult.rules, defaultOrder: requiredFieldOrder })
          : null;
      askFields = buildAskFields(missingFields, requiredFieldOrder, selection?.field ?? null);
      conversation.pendingField = askFields[0] ?? null;
    } else {
      conversation.pendingField = null;
    }

    const plan = composePlan({
      userMessage: trimmedMessage,
      known: conversation.sessionState as Partial<Record<FieldName, string | null>>,
      askFields: askFields as FieldName[],
      assigneeEmail,
      fallbackEmail: FALLBACK_EMAIL,
    });

    const rewritten = process.env.OPENAI_API_KEY ? await rewriteWithLLM({ plan }) : null;
    const responseText = rewritten ?? plan.textTemplate;
    const quickReplies = plan.kind === 'ask' ? plan.quickReplies : undefined;

    appendHistory(conversation, { role: 'assistant', content: responseText, ts: Date.now() });

    try {
      await conversationRepository.save(conversation);
    } catch (error) {
      console.error('Failed to persist conversation', error);
    }

    return { conversationId: conversation.id, response: responseText, quickReplies };
  },
});
