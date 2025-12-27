import { Router, Request, Response } from 'express';
import { ChatRequestDTO, toChatCommand, toChatResponseDTO } from '../interfaces/http/dto/chat';

export function createChatRouter({ chatService }: { chatService: any }) {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const dto = (req.body ?? {}) as ChatRequestDTO;
    const command = toChatCommand(dto);

    if (typeof command.userMessage !== 'string' || !command.userMessage.trim()) {
      res.status(400).json({ error: 'userMessage is required' });
      return;
    }

    const result = await chatService.handle(command);
    res.json(toChatResponseDTO(result));
  });

  return router;
}