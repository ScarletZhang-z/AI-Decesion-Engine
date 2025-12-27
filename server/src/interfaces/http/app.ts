import express from 'express';
import cors from 'cors';
import { createRulesRouter } from './routes/rules';
import { createConversationsRouter } from './routes/conversations';
import { createChatRouter } from '../../routes/chat';
import type { AppServices } from '../../infrastructure/container';

export function createHttpApp(services: AppServices) {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // 注册路由
  app.use('/api/rules', createRulesRouter({ service: services.ruleService }));
  app.use('/api/conversations', createConversationsRouter({ repository: services.conversationRepository }));
  app.use('/api/chat', createChatRouter({ chatService: services.chatService }));

  return app;
}