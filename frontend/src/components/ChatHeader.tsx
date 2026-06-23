import { useState } from 'react';
import { Menu, Search, X, Download, Share2, Copy, Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ChatMessage { id?: string; role: 'user' | 'ai'; text: string; }

interface Props {
  selectedModel: string;
  onModelChange: (model: string) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  currentThreadId: string | null;
  session: any;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function ChatHeader({ selectedModel, onModelChange, isSidebarOpen, onToggleSidebar, currentThreadId, session }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentThreadId || !session) return;
    try {
      const res = await fetch(`${API_URL}/api/threads/${currentThreadId}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) setSearchResults(await res.json());
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleExport = async (format: 'json' | 'md') => {
    if (!currentThreadId || !session) return;
    try {
      const res = await fetch(`${API_URL}/api/threads/${currentThreadId}/export?format=${format}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleShare = async () => {
    if (!currentThreadId || !session) return;
    try {
      const res = await fetch(`${API_URL}/api/threads/${currentThreadId}/share`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShareUrl(`${window.location.origin}${data.shareUrl}`);
      }
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
        <span className="brand-title">Nikoff Free Chatbot</span>
      </div>

      <div className="header-actions">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search messages..."
            className="search-input"
          />
          {searchResults && (
            <button className="search-clear" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="export-buttons">
          <button className="export-btn" onClick={() => handleExport('json')} title="Export as JSON">
            <Download size={16} />
          </button>
          <button className="export-btn" onClick={() => handleExport('md')} title="Export as Markdown">
            <Download size={16} />
          </button>
          <button className="export-btn" onClick={handleShare} title="Share conversation">
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
          <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
          <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
          <option value="gemini-3.0-flash">Gemini 3.0 Flash</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
          <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          <option value="gemma-4-31b-it">Gemma 4 31B (Dense)</option>
          <option value="gemma-4-26b-a4b-it">Gemma 4 26B (MoE)</option>
        </select>
      </div>
    </header>
  );
}
