import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ConversationResponse,
  fetchConversation,
  sendChatMessage,
} from "../api";
import { Message, Role } from "../types";

const createMessage = (role: Role, content: string, ts?: number): Message => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  ts,
});

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canSubmit = useMemo(
    () => input.trim().length > 0 && !sending,
    [input, sending]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const paramId = searchParams.get("conversationId");
    if (!paramId) {
      setConversationId(null);
      setMessages([]);
      return;
    }

    let active = true;

    const loadConversation = async (id: string) => {
      setLoadingHistory(true);
      setError(null);
      try {
        const data: ConversationResponse = await fetchConversation(id);
        if (!active) return;
        setConversationId(data.conversationId);
        setMessages(
          data.history.map((entry, index) => ({
            id: `${entry.ts}-${index}`,
            role: entry.role,
            content: entry.content,
            ts: entry.ts,
          }))
        );
      } catch (caughtError) {
        if (!active) return;
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load conversation";
        setError(message);
        setConversationId(null);
        setMessages([]);
      } finally {
        if (active) {
          setLoadingHistory(false);
        }
      }
    };

    loadConversation(paramId);

    return () => {
      active = false;
    };
  }, [searchParams]);

  const updateUrl = (id: string | null) => {
    const search = id ? `?conversationId=${encodeURIComponent(id)}` : "";
    navigate({ pathname: "/chat", search }, { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userText = input.trim();
    if (!userText || sending) return;

    const userMessage = createMessage("user", userText);
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const chatResponse = await sendChatMessage({
        conversationId,
        userMessage: userText,
      });

      const assistantMessage = createMessage(
        "assistant",
        chatResponse.response
      );

      setConversationId(chatResponse.conversationId);
      updateUrl(chatResponse.conversationId);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to send message";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const handleStartNew = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setInput("");
    updateUrl(null);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-page">
      <header className="chat-header">
        <h1>Frontdoor</h1>
        <div className="chat-meta">
          {conversationId ? (
            <span className="pill pill-success">Conversation {conversationId}</span>
          ) : (
            <span className="pill pill-muted">Start new chat</span>
          )}
        </div>
      </header>

      <div className="chat-window">
        {loadingHistory && <p className="placeholder">Loading history…</p>}
        {!loadingHistory && !hasMessages && (
          <div className="placeholder">
            <p>No conversation yet.</p>
            <button className="button ghost" type="button" onClick={handleStartNew}>
              Start new chat
            </button>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.role}`}>
            <span className="message-role">
              {message.role === "user" ? "You" : "Assistant"}
            </span>
            <p>{message.content}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chat-error">{error}</div>}

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What legal request do you have?"
          disabled={sending}
        />
        <button type="submit" disabled={!canSubmit}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>

      {hasMessages && (
        <button className="button ghost" type="button" onClick={handleStartNew}>
          Start new chat
        </button>
      )}
    </div>
  );
}
