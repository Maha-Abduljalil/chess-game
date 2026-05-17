import { ChatMessage } from "../services/chatService";

export function renderChatMessages(container: HTMLElement, messages: ChatMessage[]) {
  container.innerHTML = messages
    .map((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const sideClass = `msg-side--${msg.side}`;
      return `
        <div class="chat-message">
          <div class="chat-msg-header">
            <span class="chat-msg-side ${sideClass}">${msg.side.toUpperCase()}</span>
            <span class="chat-msg-author">${msg.userName}</span>
            <span class="chat-msg-time">${time}</span>
          </div>
          <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
        </div>
      `;
    })
    .join("");
  
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
