import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, ThumbsUp, ThumbsDown, Pencil, X, Check } from 'lucide-react';

interface ChatMessage { id?: string; role: 'user' | 'ai'; text: string; image?: { data: string; mimeType: string } | null; feedback?: { rating: number; comment?: string } | null; editedAt?: string | null; }

interface Props {
  messages: ChatMessage[];
  isThinking: boolean;
  onFeedback: (messageId: string, rating: number) => void;
  onEdit: (messageId: string, content: string) => void;
}

export function ChatMessages({ messages, isThinking, onFeedback, onEdit }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  return (
    <div className="chat-messages-scroll-area">
      {messages.length === 0 ? (
        <div className="empty-state-welcome">
          <Bot size={48} className="icon-subtle" />
          <h2>How can I assist your workflow today?</h2>
          <p>Select an LLM engine above to deploy complex processing arrays.</p>
        </div>
      ) : (
        messages.map((msg, index) => (
          <div key={msg.id || index} className={`message-bubble-wrapper ${msg.role === 'user' ? 'user-type' : 'ai-type'}`}>
            <div className="message-container-max-width">
              <div className="author-avatar-badge">
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="message-body-content-text">
                {editingId === msg.id ? (
                  <div className="edit-mode">
                    <textarea
                      className="edit-textarea"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEdit(msg.id!, editingText); setEditingId(null); } }}
                      rows={3}
                    />
                    <div className="edit-actions">
                      <button className="edit-save-btn" onClick={() => { onEdit(msg.id!, editingText); setEditingId(null); }}>
                        <Check size={14} /> Save
                      </button>
                      <button className="edit-cancel-btn" onClick={() => setEditingId(null)}>
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.image && (
                      <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} alt="Uploaded" className="message-image" />
                    )}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    {msg.editedAt && <span className="edited-badge">(edited)</span>}
                  </>
                )}
              </div>
            </div>
            {msg.role === 'user' && msg.id && editingId !== msg.id && (
              <div className="edit-actions-inline">
                <button className="feedback-btn" onClick={() => { setEditingId(msg.id!); setEditingText(msg.text); }} title="Edit">
                  <Pencil size={14} />
                </button>
              </div>
            )}
            {msg.role === 'ai' && msg.id && (
              <div className="feedback-actions">
                <button className={`feedback-btn ${msg.feedback?.rating === 1 ? 'active' : ''}`} onClick={() => onFeedback(msg.id!, 1)} title="Good">
                  <ThumbsUp size={14} />
                </button>
                <button className={`feedback-btn ${msg.feedback?.rating === -1 ? 'active' : ''}`} onClick={() => onFeedback(msg.id!, -1)} title="Bad">
                  <ThumbsDown size={14} />
                </button>
              </div>
            )}
          </div>
        ))
      )}
      {isThinking && (
        <div className="message-bubble-wrapper ai-type thinking-indicator">
          <div className="message-container-max-width">
            <div className="author-avatar-badge"><Bot size={16} /></div>
            <div className="thinking-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
