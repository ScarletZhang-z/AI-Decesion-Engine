import type { ChatCommand, ChatResponseDTO } from '../../interfaces/http/dto/chat';
import type { Field } from '../../domain/rules';
import type { Router as RuleRouter } from '../routing/ruleRouter';
import { Conversation, appendHistory, updateSessionState } from '../../domain/conversation';
import type { FieldExtractor } from './fieldExtractor';
import { parseAnswerForField } from './fieldParsers';
import { composePlan } from '../responseComposer';
import type { FieldName } from '../responseComposer';
import { rewriteWithLLM } from '../llmCopywriter';
import type { ConversationRepository } from './conversationRepository';
import { FIELD_ORDER } from '../../config/fieldOrder';

type Dependencies = {
  conversationRepository: ConversationRepository;
  ruleRouter: RuleRouter;
  fieldExtractor: FieldExtractor;
  requiredFieldOrder?: Field[];
};

const DEFAULT_REQUIRED_FIELD_ORDER: Field[] = [...FIELD_ORDER];
const FALLBACK_EMAIL = process.env.FALLBACK_EMAIL ?? 'legal@acme.corp';

type NormalizedCommand = {
  trimmedMessage: string;
  now: number;
  incomingId?: string;
};

const pickNextField = (missingFields: Field[], requiredFieldOrder: Field[], preferred?: Field | null): Field | null => {
  const prioritized: Field[] = [];
  if (preferred && missingFields.includes(preferred)) prioritized.push(preferred);

  const orderedMissing = requiredFieldOrder.filter((f) => missingFields.includes(f));
  for (const f of orderedMissing) if (!prioritized.includes(f)) prioritized.push(f);

  for (const f of missingFields) if (!prioritized.includes(f)) prioritized.push(f);

  return prioritized[0] ?? null;
};

const normalizeCommand = (command: ChatCommand): NormalizedCommand => {
  const trimmedMessage = command.userMessage.trim();
  const now = Date.now();

  const incomingId =
    typeof command.conversationId === 'string' && command.conversationId.trim()
      ? command.conversationId.trim()
      : undefined;

  return { trimmedMessage, now, incomingId };
};

const loadOrCreateConversation = async (incomingId: string | undefined, conversationRepository: ConversationRepository) => {
  let conversation: Conversation | null = null;

  if (incomingId) conversation = await conversationRepository.get(incomingId);
  if (!conversation) conversation = conversationRepository.create(incomingId);

  return conversation;
};

const recordUserMessage = (conversation: Conversation, trimmedMessage: string, ts: number) => {
  appendHistory(conversation, { role: 'user', content: trimmedMessage, ts });
};

const resolveFields = async (conversation: Conversation, trimmedMessage: string, fieldExtractor: FieldExtractor) => {
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

  return { parsedFromPending };
};

const routeAndApply = async (
  conversation: Conversation,
  {
    ruleRouter,
  }: {
    ruleRouter: RuleRouter;
  }
) => {
  // Route based on current session state
  const ruleResult = await ruleRouter.route({ sessionState: conversation.sessionState });

  let nextField: Field | null = null;
  let assigneeEmail: string | null = null;
  
  if (ruleResult.status === 'matched') {
    assigneeEmail = ruleResult.assigneeEmail;
    conversation.pendingField = null;
  } else if (ruleResult.status === 'missing_fields') {
    conversation.pendingField = ruleResult.fields[0] ?? null;
  } else {
    conversation.pendingField = null;
  }

  return { ruleResult, nextField, assigneeEmail };
};

const buildResponse = async (params: {
  trimmedMessage: string;
  conversation: Conversation;
  nextField: Field | null;
  assigneeEmail: string | null;
  fallbackEmail: string;
}) => {
  const { trimmedMessage, conversation, nextField, assigneeEmail, fallbackEmail } = params;

  const plan = composePlan({
    userMessage: trimmedMessage,
    known: conversation.sessionState as Partial<Record<FieldName, string | null>>,
    nextField: nextField ?? undefined,
    assigneeEmail,
    fallbackEmail,
  });

  const rewritten = process.env.OPENAI_API_KEY ? await rewriteWithLLM({ plan }) : null;
  const responseText = rewritten ?? plan.textTemplate;
  const quickReplies = plan.kind === 'ask' ? plan.quickReplies : undefined;

  return { responseText, quickReplies };
};

const recordAndPersist = async (
  conversation: Conversation,
  responseText: string,
  conversationRepository: ConversationRepository
) => {
  appendHistory(conversation, { role: 'assistant', content: responseText, ts: Date.now() });

  try {
    await conversationRepository.save(conversation);
  } catch (error) {
    console.error('Failed to persist conversation', error);
  }
};

export const createChatService = ({
  conversationRepository,
  ruleRouter,
  fieldExtractor
}: Dependencies) => {
  return {
    async handle(command: ChatCommand): Promise<ChatResponseDTO> {
      // Step 1: Normalize and validate command
      const { trimmedMessage, now, incomingId } = normalizeCommand(command);
      // Step 2: Load or create conversation
      const conversation = await loadOrCreateConversation(incomingId, conversationRepository);
      // Step 3: Record user message
      recordUserMessage(conversation, trimmedMessage, now);
      // Step 4: Resolve fields from user message
      await resolveFields(conversation, trimmedMessage, fieldExtractor);
      // Step 5: Route based on current session state and determine next actions
      const { nextField, assigneeEmail } = await routeAndApply(conversation, {
        ruleRouter,
      });
      // Step 6: Build response for the user
      const { responseText, quickReplies } = await buildResponse({
        trimmedMessage,
        conversation,
        nextField,
        assigneeEmail,
        fallbackEmail: FALLBACK_EMAIL,
      });
      // Step 7: Record assistant response and persist conversation state
      await recordAndPersist(conversation, responseText, conversationRepository);
      // Step 8: Return response
      return { conversationId: conversation.id, response: responseText, quickReplies };
    },
  };
};
