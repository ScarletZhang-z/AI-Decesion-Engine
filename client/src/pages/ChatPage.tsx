import { useState } from "react";
import { HeroSection } from "../components/mobile/HeroSection";
import { MobileChatHeader } from "../components/mobile/MobileChatHeader";
import { ChatTranscript } from "../components/mobile/ChatTranscript";
import { ChatControls } from "../components/mobile/ChatControls";
import { useMobileChatSession } from "../hooks/useMobileChatSession";
import "../ChatPage.css";

const heroSuggestions = [
  "I need a contract approved",
  "I have an employment question",
  "I need legal review for a campaign",
];

export default function ChatPage() {
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
        <ChatControls
          mode={mode}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onActivateChat={activateChat}
        />
      </div>
    </div>
  );
}
