import './env';
import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import rulesRouter, { getRules } from './routes/rules';
import { createConversationsRouter } from './routes/conversations';
import { ChatRequestDTO, toChatCommand, toChatResponseDTO } from './interfaces/http/dto/chat';
import type { RuleRepository } from './application/routing/ruleRouter';
import { createRuleRouter } from './application/routing/ruleRouter';
import { createConversationRepository } from './application/conversations/conversationRepository';
import { createChatService } from './application/conversations/chatService';
import { createLLMFieldExtractor } from './application/conversations/llmFieldExtractor';

if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. LLM calls will fail.');
}

const app = express();
const port = Number.parseInt(process.env.PORT ?? '5000', 10);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

const ruleRepository: RuleRepository = {
  getAll: () => getRules(),
};


const ruleRouter = createRuleRouter({ repository: ruleRepository });

const conversationRepository = createConversationRepository();
const fieldExtractor = createLLMFieldExtractor(openai);



const chatService = createChatService({ conversationRepository, fieldExtractor, ruleRouter });
const conversationsRouter = createConversationsRouter({ repository: conversationRepository });

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
