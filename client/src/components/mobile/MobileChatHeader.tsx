import { ArrowLeftIcon, MoreIcon, SpeakerIcon } from "../Icons";
import "./MobileChatHeader.css";

export function MobileChatHeader() {
  return (
    <header className="mobile-chat-header">
      <button className="icon-button" aria-label="Back">
        <ArrowLeftIcon />
      </button>
      <span className="mobile-title">Legal AI Assistant</span>
    </header>
  );
}
