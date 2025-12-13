export interface ChatRequestDTO {
  conversationId?: string;
  userMessage: string;
}

export interface ChatCommand {
  conversationId?: string;
  userMessage: string;
}

export interface ChatResponseDTO {
  conversationId: string;
  response: string;
}

export const toChatCommand = (dto: ChatRequestDTO): ChatCommand => ({
  conversationId: dto.conversationId,
  userMessage: dto.userMessage,
});

export const toChatResponseDTO = (result: ChatResponseDTO): ChatResponseDTO => result;
