import { useEffect, useRef } from "react";
import { ChatMessage } from "./types";

export function ChatTranscript({ messages }: { messages: ChatMessage[] }) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  return (
    <section className="mobile-chat-body" ref={containerRef}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <TypingIndicator />
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

