import { FormEvent, KeyboardEvent, useEffect, useRef } from "react";
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const maxHeight = 140;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  return (
    <form
      className={`mobile-input-bar ${voiceMode ? "voice-mode" : ""}`}
      onSubmit={handleSubmit}
    >
      {!voiceMode ? (
        <div className="mobile-input-border">
          <div className="mobile-input-shell">
            <textarea
              ref={inputRef}
              className="mobile-input-field"
              placeholder="ASK AI ASSISTANT"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              spellCheck={false}
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
