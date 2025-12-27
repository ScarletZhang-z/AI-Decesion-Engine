import './env';
import { buildContainer } from './infrastructure/container';
import { createHttpApp } from './interfaces/http/app';
import { getServerConfig } from './interfaces/http/server';
import { startConversationSweeper } from './infrastructure/conversationSweep';

// check required env variables
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. LLM calls will fail.');
}

// 1. get server config
const config = getServerConfig();

// 2. build services container
const services = buildContainer();

// 3. create HTTP app
const app = createHttpApp(services);

// 4. start conversation sweeper
const stopSweeper = startConversationSweeper({
  conversationRepository: services.conversationRepository,
  intervalMs: 60_000,
});

// 5. start server
const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

// 6. graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopSweeper();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
