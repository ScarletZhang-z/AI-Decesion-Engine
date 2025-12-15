import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ConversationResponse,
  fetchConversation,
  sendChatMessage,
} from "../api";
import { ChatMessage } from "../components/mobile/types";
import { Message, Role } from "../types";

type Mode = "intro" | "chat";

const createMessage = (role: Role, content: string, ts?: number): Message => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  ts,
});

export function useMobileChatSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("intro");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUrl = useCallback(
    (id: string | null) => {
      const search = id ? `?conversationId=${encodeURIComponent(id)}` : "";
      navigate({ pathname: "/mobile-chat", search }, { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    const paramId = searchParams.get("conversationId");
    if (!paramId) {
      setConversationId(null);
      setMessages([]);
      setMode("intro");
      return;
    }

    let active = true;
    setMode("chat");

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
        setMode("intro");
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

  const chatMessages: ChatMessage[] = useMemo(
    () =>
      messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.content,
      })),
    [messages]
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMessage = createMessage("user", trimmed);
      setMessages((prev) => [...prev, userMessage]);
      setMode("chat");
      setError(null);
      setSending(true);

      const run = async () => {
        try {
          const chatResponse = await sendChatMessage({
            conversationId,
            userMessage: trimmed,
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

      run();
    },
    [conversationId, sending, updateUrl]
  );

  const activateChat = useCallback(() => setMode("chat"), []);

  return {
    mode,
    isChatMode: mode === "chat",
    chatMessages,
    loadingHistory,
    sending,
    error,
    sendMessage,
    activateChat,
  };
}
