import { Router, Request, Response } from 'express';
import type { ConversationRepository } from '../application/conversations/conversationRepository';

export const createConversationsRouter = ({ repository }: { repository: ConversationRepository }): Router => {
  const router = Router();

  router.get('/:id', async (req: Request, res: Response) => {
    const conversationId = req.params.id;

    try {
      const conversation = await repository.get(conversationId);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.json({ conversationId: conversation.id, history: conversation.history });
    } catch (error) {
      console.error('Failed to load conversation', error);
      res.status(500).json({ error: 'Failed to load conversation' });
    }
  });

  return router;
};
