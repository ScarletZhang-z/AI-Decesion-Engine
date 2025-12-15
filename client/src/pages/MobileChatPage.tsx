import { useState } from "react";
import "../MobileChatPage.css";
import { HeroSection } from "../components/mobile/HeroSection";
import { MobileChatHeader } from "../components/mobile/MobileChatHeader";
import { MobileInputBar } from "../components/mobile/MobileInputBar";
import { ChatTranscript } from "../components/mobile/ChatTranscript";
import { ChatMessage } from "../components/mobile/types";

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
  const [voiceMode, setVoiceMode] = useState(false);
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
    setVoiceMode(false);
    setInputValue("");
  };

  const handleSubmit = () => {
    sendMessage(inputValue);
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleMicClick = () => {
    if (inputValue.trim()) {
      sendMessage(inputValue);
      return;
    }
    setVoiceMode(true);
  };

  const handlePressToSpeak = () => {
    setMode("chat");
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
        <FloatingAgent />
        <MobileInputBar
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          voiceMode={voiceMode}
          onMicClick={handleMicClick}
          onPressToSpeak={handlePressToSpeak}
          onExitVoiceMode={() => setVoiceMode(false)}
        />
      </div>
    </div>
  );
}

function FloatingAgent() {
  return <div className="floating-agent" aria-hidden="true" />;
}