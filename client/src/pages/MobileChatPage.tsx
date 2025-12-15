import { useState } from "react";
import { HeroSection } from "../components/mobile/HeroSection";
import { MobileChatHeader } from "../components/mobile/MobileChatHeader";
import { ChatTranscript } from "../components/mobile/ChatTranscript";
import { VoiceInputController } from "../components/mobile/VoiceInputController";
import { useMobileChatSession } from "../hooks/useMobileChatSession";
import "../MobileChatPage.css";

const heroSuggestions = [
  "Ask about visa",
  "Get legal help",
  "Understand my rights",
];

export default function MobileChatPage() {
  const [inputValue, setInputValue] = useState("");
  const {
    mode,
    isChatMode,
    chatMessages,
    loadingHistory,
    sending,
    error,
    sendMessage,
    activateChat,
  } = useMobileChatSession();

  const handleSend = (text: string) => {
    sendMessage(text);
    setInputValue("");
  };

  return (
    <div className="mobile-chat-page">
      <div className={`mobile-chat-frame ${isChatMode ? "is-chat" : ""}`}>
        { isChatMode && <MobileChatHeader />}
        {mode === "intro" ? (
          <HeroSection
            suggestions={heroSuggestions}
            onSelectSuggestion={(text) => {
              handleSend(text);
            }}
          />
        ) : (
          <>
            {loadingHistory ? (
              <div className="mobile-chat-placeholder">Loading conversation…</div>
            ) : (
              <ChatTranscript messages={chatMessages} showTyping={sending} />
            )}
          </>
        )}
        {error ? (
          <div className="mobile-chat-status error" role="alert">
            {error}
          </div>
        ) : null}
        {loadingHistory && (
          <div className="mobile-chat-status">Syncing history…</div>
        )}
        {mode === "chat" && <FloatingAgent />}
        <VoiceInputController
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onActivateChat={activateChat}
        />
      </div>
    </div>
  );
}

function FloatingAgent() {
  return <div className="floating-agent" aria-hidden="true" />;
}
