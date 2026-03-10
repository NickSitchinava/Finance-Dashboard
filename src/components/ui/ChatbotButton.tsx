import "./ChatbotButton.css";

interface ChatbotButtonProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatbotButton({ isOpen, onClose }: ChatbotButtonProps) {
  if (!isOpen) return null;

  return (
    <div className="chatbot-window">
      <div className="chatbot-header">
        <div className="chatbot-header__title">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="chatbot-header__label">AI Assistant</span>
        </div>
        <button className="chatbot-header__close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="chatbot-content">
        <div className="message message--bot">
          Hello! I'm your AI dashboard assistant. How can I help you manage
          your projects or finances today?
        </div>
      </div>

      <div className="chatbot-input">
        <input type="text" placeholder="AI Chat coming soon..." disabled />
        <button disabled className="btn btn--primary chatbot-send-btn">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}