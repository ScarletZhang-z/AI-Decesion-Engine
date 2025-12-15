import { ArrowLeftIcon, MoreIcon, SpeakerIcon } from "../Icons";

export function MobileChatHeader() {
  return (
    <header className="mobile-chat-header">
      <button className="icon-button" aria-label="Back">
        <ArrowLeftIcon />
      </button>
      <span className="mobile-title">Legal AI Assistant</span>
      <div className="header-actions">
        <button className="icon-button" aria-label="Sound">
          <SpeakerIcon />
        </button>
        <button className="icon-button" aria-label="More">
          <MoreIcon />
        </button>
      </div>
    </header>
  );
}
