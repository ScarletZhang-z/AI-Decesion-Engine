import { useState } from "react";
import "../MobileChatPage.css";
import { HeroSection } from "../components/mobile/HeroSection";
import { MobileChatHeader } from "../components/mobile/MobileChatHeader";
import { ChatTranscript } from "../components/mobile/ChatTranscript";
import { ChatMessage } from "../components/mobile/types";
import { VoiceInputController } from "../components/mobile/VoiceInputController";

type Mode = "intro" | "chat";

const heroSuggestions = [
  "Ask about visa",
  "Get legal help",
  "Understand my rights",
];

const DEFAULT_ASSISTANT_REPLY =
  "Sure! Are you planning to visit, study, or work in Australia?";

const starterMessages: ChatMessage[] = [
  {
    id: "u-1",
    role: "user",
    text: "Hi, I want to ask about the visa requirements for Australia.",
  },
  {
    id: "a-1",
    role: "assistant",
    text: DEFAULT_ASSISTANT_REPLY,
  },
];

export default function MobileChatPage() {
  const [mode, setMode] = useState<Mode>("intro");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userEntry: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    const assistantEntry: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      role: "assistant",
      text: DEFAULT_ASSISTANT_REPLY,
    };

    setMessages((prev) => [...prev, userEntry, assistantEntry]);
    setMode("chat");
    setInputValue("");
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <div className="mobile-chat-page">
      <div className={`mobile-chat-frame ${mode === "chat" ? "is-chat" : ""}`}>
        <MobileChatHeader />
        {mode === "intro" ? (
          <HeroSection
            suggestions={heroSuggestions}
            onSelectSuggestion={handleSuggestion}
          />
        ) : (
          <ChatTranscript messages={messages} />
        )}
        { mode === "chat" && <FloatingAgent /> }
        <VoiceInputController
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          onActivateChat={() => setMode("chat")}
        />
      </div>
    </div>
  );
}

function FloatingAgent() {
  return <div className="floating-agent" aria-hidden="true" />;
}
