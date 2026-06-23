import { useState } from 'react';
import { MessageSquare, Plus, Menu, X, LogOut, Pencil, Settings, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useI18n } from '../context/I18nContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Thread { id: string; title: string; createdAt: string; systemPrompt?: string | null; }

interface Props {
  threads: Thread[];
  currentThreadId: string | null;
  isSidebarOpen: boolean;
  session: any;
  onSelectThread: (id: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onToggleSidebar: () => void;
  onSystemPromptChange: (threadId: string, prompt: string | null) => void;
  onOpenAdmin: () => void;
}

export function Sidebar({ threads, currentThreadId, isSidebarOpen, session, onSelectThread, onCreateThread, onDeleteThread, onRenameThread, onToggleSidebar, onSystemPromptChange, onOpenAdmin }: Props) {
  const { t } = useI18n();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState('');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptText, setPromptText] = useState('');

  const currentThread = threads.find(t => t.id === currentThreadId);

  const handleOpenPrompt = () => {
    setPromptText(currentThread?.systemPrompt || '');
    setShowPromptModal(true);
  };

  const handleSavePrompt = async () => {
    if (!currentThreadId || !session) return;
    await onSystemPromptChange(currentThreadId, promptText || null);
    setShowPromptModal(false);
  };

  return (
    <aside className={`navigation-sidebar ${isSidebarOpen ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-top-action">
        <button className="new-chat-button" onClick={onCreateThread}>
          <Plus size={18} />
          {isSidebarOpen && <span>{t('sidebar.newChat')}</span>}
        </button>
        <button className="sidebar-toggle-inner" onClick={onToggleSidebar}>
          {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {isSidebarOpen && (
        <div className="threads-history-container">
            <p className="history-section-heading">{t('sidebar.recent')}</p>
          <div className="threads-list">
            {threads.map(thread => {
              const date = new Date(thread.createdAt);
              const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={thread.id}
                  className={`thread-item-row ${currentThreadId === thread.id ? 'active-thread' : ''}`}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <div className="thread-icon-wrapper">
                    <MessageSquare size={16} className="thread-icon" />
                    {currentThreadId === thread.id && <span className="active-dot"></span>}
                  </div>
                  <div className="thread-info">
                    {renamingId === thread.id ? (
                      <input
                        className="thread-rename-input"
                        value={renamingText}
                        onChange={(e) => setRenamingText(e.target.value)}
                        onBlur={() => { onRenameThread(thread.id, renamingText); setRenamingId(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { onRenameThread(thread.id, renamingText); setRenamingId(null); }
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="thread-title-ellipsis">{thread.title}</span>
                    )}
                    <span className="thread-date">{dateStr} · {timeStr}</span>
                  </div>
                  <div className="thread-actions">
                    <button
                      className="thread-action-btn"
                      onClick={(e) => { e.stopPropagation(); setRenamingId(thread.id); setRenamingText(thread.title); }}
                      title="Rename"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="thread-action-btn thread-delete-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }}
                      title="Delete"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <div className="user-profile-cabinet-footer">
          {currentThreadId && (
            <button className="system-prompt-btn" onClick={handleOpenPrompt} title={t('sidebar.systemPrompt')}>
              <Settings size={16} />
              <span>{t('sidebar.systemPrompt')}</span>
            </button>
          )}
          <button className="system-prompt-btn" onClick={onOpenAdmin} title={t('sidebar.admin')}>
            <Shield size={16} />
            <span>{t('sidebar.admin')}</span>
          </button>
          <div className="user-avatar-placeholder">
            {session.user?.email?.[0].toUpperCase()}
          </div>
          <div className="user-meta-info">
            <p className="profile-name">{session.user?.email}</p>
            <button className="logout-action-text-btn" onClick={() => supabase.auth.signOut()}>
              <LogOut size={12} /> {t('sidebar.signOut')}
            </button>
          </div>
        </div>
      )}

      {showPromptModal && (
        <div className="modal-overlay" onClick={() => setShowPromptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('modal.systemPrompt')}</h3>
              <button className="modal-close" onClick={() => setShowPromptModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="modal-description">{t('modal.systemPromptDesc')}</p>
            <textarea
              className="modal-textarea"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. You are a helpful coding assistant. Always respond in Russian. Be concise..."
              rows={6}
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowPromptModal(false)}>{t('modal.cancel')}</button>
              <button className="modal-save" onClick={handleSavePrompt}>{t('modal.save')}</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
