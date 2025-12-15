import { ChatMessage } from "./types";

export function ChatTranscript({ messages }: { messages: ChatMessage[] }) {
  return (
    <section className="mobile-chat-body">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <TypingIndicator />
      <FloatingAgent />
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`bubble ${message.role}`}>
      <p>{message.text}</p>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-dots" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
    </div>
  );
}

function FloatingAgent() {
  return <div className="floating-agent" aria-hidden="true" />;
}
