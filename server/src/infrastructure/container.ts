import OpenAI from 'openai';
import { createFsRuleRepository } from './fsRuleRepository';
import { createFsConversationRepository } from './fsConversationRepository';
import { createLLMFieldExtractor } from './llmFieldExtractor';
import { createRuleService } from '../application/rules/ruleService';
import { createChatService } from '../application/conversations/chatService';
import { createRuleRouter } from '../application/routing/ruleRouter';
import { FIELD_ORDER } from '../config/fieldOrder';

export interface AppServices {
  ruleService: ReturnType<typeof createRuleService>;
  chatService: ReturnType<typeof createChatService>;
  conversationRepository: ReturnType<typeof createFsConversationRepository>;
}

export function buildContainer(): AppServices {
  // base services
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  const ruleRepository = createFsRuleRepository();
  const conversationRepository = createFsConversationRepository();
  const fieldExtractor = createLLMFieldExtractor(openai);

  // application services
  const ruleRouter = createRuleRouter({
    repository: ruleRepository,
    fieldOrder: FIELD_ORDER,
  });

  const ruleService = createRuleService({ repository: ruleRepository });

  const chatService = createChatService({
    conversationRepository,
    fieldExtractor,
    ruleRouter,
    requiredFieldOrder: FIELD_ORDER,
  });

  return {
    ruleService,
    chatService,
    conversationRepository,
  };
}