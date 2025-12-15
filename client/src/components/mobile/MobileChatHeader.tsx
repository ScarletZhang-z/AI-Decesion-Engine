import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon, MoreIcon, SpeakerIcon } from "../Icons";
import "./MobileChatHeader.css";

export function MobileChatHeader() {
  const navigate = useNavigate();

  const handleBack = () => {
    // Clear any active conversation by returning to the base mobile chat route
    navigate({ pathname: "/mobile-chat", search: "" }, { replace: true });
  };

  return (
    <header className="mobile-chat-header">
      <button className="icon-button" aria-label="Back" onClick={handleBack}>
        <ArrowLeftIcon />
      </button>
      <span className="mobile-title">Legal AI Assistant</span>
    </header>
  );
}
