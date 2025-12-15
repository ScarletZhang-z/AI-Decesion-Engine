import { FormEvent } from "react";
import { MicIcon, PlusIcon, TypeIcon } from "../Icons";

type MobileInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  voiceMode: boolean;
  onMicClick: () => void;
  onPressToSpeak: () => void;
  onExitVoiceMode: () => void;
};

export function MobileInputBar({
  value,
  onChange,
  onSubmit,
  voiceMode,
  onMicClick,
  onPressToSpeak,
      onExitVoiceMode,
}: MobileInputBarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className={`mobile-input-bar ${voiceMode ? "voice-mode" : ""}`}
      onSubmit={handleSubmit}
    >
      {!voiceMode ? (
        <div className="mobile-input-border">
          <div className="mobile-input-shell">
            <input
              className="mobile-input-field"
              type="text"
              placeholder="ASK AI ASSISTANT"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
            <button
              className="icon-button mic-button input-mic-button"
              type="button"
              aria-label="Switch to voice input"
              onClick={onMicClick}
            >
              <MicIcon />
            </button>
          </div>
        </div>
      ) : (
        <div className="voice-input-shell">
          <div className="voice-input-inner">
            <button
              className="press-to-speak"
              type="button"
              onClick={onPressToSpeak}
            >
              <span>Press and hold to speak</span>
            </button>
            <button
              className="icon-button keyboard-button"
              type="button"
              aria-label="Switch to text input"
              onClick={onExitVoiceMode}
            >
              <TypeIcon />
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
