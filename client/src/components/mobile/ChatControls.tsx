import { VoiceInputController } from "./VoiceInputController";

type ChatControlsProps = {
  mode: "intro" | "chat";
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  onActivateChat: () => void;
};

export function ChatControls({
  mode,
  inputValue,
  onInputChange,
  onSend,
  onActivateChat,
}: ChatControlsProps) {
  return (
    <div className="mobile-chat-controls">
      {mode === "chat" && <FloatingAgent />}
      <VoiceInputController
        value={inputValue}
        onChange={onInputChange}
        onSend={onSend}
        onActivateChat={onActivateChat}
      />
    </div>
  );
}

function FloatingAgent() {
  return <div className="floating-agent" aria-hidden="true" />;
}
