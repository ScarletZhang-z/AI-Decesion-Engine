import './env';
import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { ChatRequestDTO, toChatCommand, toChatResponseDTO } from './interfaces/http/dto/chat';
import { createRuleRouter } from './application/routing/ruleRouter';
import { createChatService } from './application/conversations/chatService';
import { createRulesRouter } from './interfaces/http/routes/rules';
import { createConversationsRouter } from './interfaces/http/routes/conversations';
import { createFsRuleRepository } from './infrastructure/fsRuleRepository';
import { createFsConversationRepository } from './infrastructure/fsConversationRepository';
import { createLLMFieldExtractor } from './infrastructure/llmFieldExtractor';
import { createRuleService } from './application/rules/ruleService';
import { FIELD_ORDER } from './config/fieldOrder';

if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. LLM calls will fail.');
}

const app = express();
const port = Number.parseInt(process.env.PORT ?? '5000', 10);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

const ruleRepository = createFsRuleRepository();
const ruleService = createRuleService({ repository: ruleRepository });

const ruleRouter = createRuleRouter({ repository: ruleRepository, fieldOrder: FIELD_ORDER });

const conversationRepository = createFsConversationRepository();
const fieldExtractor = createLLMFieldExtractor(openai);

const chatService = createChatService({
  conversationRepository,
  fieldExtractor,
  ruleRouter,
  requiredFieldOrder: FIELD_ORDER,
});
const conversationsRouter = createConversationsRouter({ repository: conversationRepository });
const rulesRouter = createRulesRouter({ service: ruleService });

setInterval(() => {
  conversationRepository.sweepExpired().catch((error) => {
    console.error('Error sweeping expired conversations', error);
  });
}, 60_000);

app.use('/api/rules', rulesRouter);
app.use('/api/conversations', conversationsRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req: Request, res: Response) => {
  // I usually separate HTTP and core logic by using small translator functions
  //DTOs describe the raw HTTP shape
  // while toCommand and toResponseDTO act as translators
  const dto = (req.body ?? {}) as ChatRequestDTO;
  // toChatCommand cleans and converts that raw request into something the app logic can safely use.
  const command = toChatCommand(dto);

  if (typeof command.userMessage !== 'string' || !command.userMessage.trim()) {
    res.status(400).json({ error: 'userMessage is required' });
    return;
  }

  const result = await chatService.handle(command);
  // toChatResponseDTO does the opposite — it formats the business result back into a JSON response for the client.
  res.json(toChatResponseDTO(result));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
