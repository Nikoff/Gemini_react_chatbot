import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Menu, Search, X, Download, Share2, Copy, Check } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { api } from '../utils/apiClient';

interface ChatMessage { id?: string; role: 'user' | 'ai'; text: string; }

interface Props {
  selectedModel: string;
  onModelChange: (model: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  currentThreadId: string | null;
  session: Session;
}

export function ChatHeader({ selectedModel, onModelChange, isSidebarOpen, onToggleSidebar, currentThreadId, session }: Props) {
  const { locale, setLocale, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentThreadId || !session) return;
    try {
      const data = await api<ChatMessage[]>(`/api/threads/${currentThreadId}/search?q=${encodeURIComponent(searchQuery)}`, {
        token: session.access_token,
      });
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleExport = async (format: 'json' | 'md') => {
    if (!currentThreadId || !session) return;
    try {
      const res = await api<Response>(`/api/threads/${currentThreadId}/export?format=${format}`, {
        token: session.access_token,
        raw: true,
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleShare = async () => {
    if (!currentThreadId || !session) return;
    try {
      const data = await api<{ shareUrl: string }>(`/api/threads/${currentThreadId}/share`, {
        method: 'POST',
        token: session.access_token,
      });
      setShareUrl(`${window.location.origin}${data.shareUrl}`);
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="workspace-top-navbar">
      {!isSidebarOpen && (
        <button className="sidebar-toggle-outer" onClick={onToggleSidebar}>
          <Menu size={20} />
        </button>
      )}
      <div className="brand-logo-zone">
        <span className="brand-title">{t('header.title')}</span>
        <div className="lang-flags">
          <button
            className={`lang-flag-btn ${locale === 'en' ? 'active' : ''}`}
            onClick={() => setLocale('en')}
            title="English"
          >
            <img src="https://flagcdn.com/w40/gb.png" alt="EN" className="flag-img" />
          </button>
          <button
            className={`lang-flag-btn ${locale === 'ru' ? 'active' : ''}`}
            onClick={() => setLocale('ru')}
            title="Russian"
          >
            <img src="https://flagcdn.com/w40/ru.png" alt="RU" className="flag-img" />
          </button>
        </div>
      </div>

      <div className="header-actions">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder={t('header.search')}
            className="search-input"
          />
          {searchResults && (
            <button className="search-clear" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="export-buttons">
          <button className="export-btn" onClick={() => handleExport('json')} title={t('header.exportJson')}>
            <Download size={16} />
          </button>
          <button className="export-btn" onClick={() => handleExport('md')} title={t('header.exportMd')}>
            <Download size={16} />
          </button>
          <button className="export-btn" onClick={handleShare} title={t('header.share')}>
            <Share2 size={16} />
          </button>
        </div>

        {shareUrl && (
          <div className="share-url-bar">
            <input type="text" readOnly value={shareUrl} className="share-url-input" />
            <button className="share-copy-btn" onClick={handleCopyLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}

        <select value={selectedModel} onChange={(e) => onModelChange(e.target.value)} className="model-selector-dropdown">
          <option value="gemini-3.5-flash">{t('header.model.gemini35')}</option>
          <option value="gemini-3.1-flash-lite">{t('header.model.gemini31')}</option>
          <option value="gemini-3.0-flash">{t('header.model.gemini30')}</option>
          <option value="gemini-2.5-flash">{t('header.model.gemini25')}</option>
          <option value="gemini-2.5-flash-lite">{t('header.model.gemini25l')}</option>
          <option value="gemini-2.0-flash">{t('header.model.gemini20')}</option>
          <option value="gemma-4-31b-it">{t('header.model.gemma431')}</option>
          <option value="gemma-4-26b-a4b-it">{t('header.model.gemma426')}</option>
        </select>
      </div>
    </header>
  );
}
