export function startConversationSweeper({
  conversationRepository,
  intervalMs = 60_000,
}: {
  conversationRepository: any;
  intervalMs?: number;
}) {
  const timerId = setInterval(() => {
    conversationRepository.sweepExpired().catch((error: Error) => {
      console.error('Error sweeping expired conversations', error);
    });
  }, intervalMs);

  // return stop function
  return () => clearInterval(timerId);
}