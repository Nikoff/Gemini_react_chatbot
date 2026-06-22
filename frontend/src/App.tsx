import React, { useState, useEffect, useRef } from 'react';
import { useStats } from './context/StatsContext';
import { StatsDashboard } from './components/StatsDashboard';
import { supabase } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, Plus, Menu, X, Send, Bot, User, LogOut, Search, Download, ThumbsUp, ThumbsDown } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ChatMessage { id?: string; role: 'user' | 'ai'; text: string; feedback?: { rating: number; comment?: string } | null; }
interface ChatThread { id: string; title: string; }

export default function App() {
  const { trackRequest } = useStats();
  const [session, setSession] = useState<any>(null); // Track Auth Session
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // DYNAMIC SIDEBAR DATABASE STATE TRACKING
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Monitor user authentication state changes and fetch live threads
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        syncUserWithBackend(session.access_token, session.user?.email);
        loadUserThreads(session.access_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        syncUserWithBackend(session.access_token, session.user?.email);
        loadUserThreads(session.access_token);
      } else {
        // Purge memory cache instantly on logout
        setSession(null);
        setThreads([]);
        setCurrentThreadId(null);
        setMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync relational core with cloud postgres schema using explicit transient values
  const syncUserWithBackend = async (token: string, email?: string) => {
    if (!email) return;
    try {
      await fetch(`${API_URL}/api/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });
    } catch (err) {
      console.error("Identity sync network exception:", err);
    }
  };

// 1. SAFE THREAD LIST LOADING
  const loadUserThreads = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/threads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        console.error("Backend refused to serve threads. Status:", res.status);
        setThreads([]);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setThreads(data);
        if (data.length > 0 && !currentThreadId) {
          setCurrentThreadId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Network exception pulling database channels:", err);
      setThreads([]);
    }
  };

  // Pull past chat messages reactively whenever thread refocuses
  useEffect(() => {
    if (!currentThreadId || !session) return;

   const loadThreadMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/api/threads/${currentThreadId}/messages`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (!res.ok) {
          console.error("Backend refused to serve messages. Status:", res.status);
          return;
        }
        
        const historicalMessages = await res.json();
        if (Array.isArray(historicalMessages)) {
          setMessages(historicalMessages);
        }
      } catch (err) {
        console.error("Failed to load historical messages:", err);
      }
    };

    loadThreadMessages();
  }, [currentThreadId, session]);

  // 3. SAFE MANUAL NEW CHAT CREATION
  const handleCreateNewChat = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/api/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          title: `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
        })
      });

      if (!res.ok) {
        alert("Authentication failed: Unable to create new workspace context.");
        return;
      }

      const newThread = await res.json();
      setThreads(prevThreads => [newThread, ...prevThreads]);
      setCurrentThreadId(newThread.id);
      setMessages([]); 
    } catch (err) {
      console.error("Failed creating thread channel:", err);
    }
  };

  const handleFeedback = async (messageId: string, rating: number) => {
    if (!session) return;
    try {
      await fetch(`${API_URL}/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ rating })
      });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, feedback: { rating } } : m
      ));
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentThreadId || !session) return;
    try {
      const res = await fetch(`${API_URL}/api/threads/${currentThreadId}/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const results = await res.json();
        setSearchResults(results);
      }
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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

// 4. SAFE CONVERSATIONAL STREAM SUBMISSION
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session) return;

    let activeThreadId = currentThreadId;

    // Auto-create database thread if user submits prompt into empty channel
    if (!activeThreadId) {
      try {
        const titleSnippet = input.trim().substring(0, 30) + (input.length > 30 ? '...' : '');
        const res = await fetch(`${API_URL}/api/threads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ title: titleSnippet })
        });

        if (!res.ok) {
          console.error("Failed to auto-create thread envelope due to authorization constraints.");
          return;
        }

        const newThread = await res.json();
        setThreads(prev => [newThread, ...prev]);
        setCurrentThreadId(newThread.id);
        activeThreadId = newThread.id;
      } catch (err) {
        console.error("Failed to auto-generate context thread container:", err);
        return;
      }
    }

    const userMessage: ChatMessage = { role: 'user', text: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');

    const startTime = Date.now();

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          messages: updatedMessages, 
          model: selectedModel,
          userId: session.user.id,        
          threadId: activeThreadId        
        })
      });
      
      if (!response.ok) {
        console.error("Chat message generation rejected by backend framework layer.");
        return;
      }

      const data = await response.json();
      const endTime = Date.now();

      if (data.text) {
        setMessages([...updatedMessages, { role: 'ai', text: data.text }]);
        trackRequest(data.usage.promptTokens, data.usage.candidatesTokens, data.usage.totalTokens, endTime - startTime, data.modelUsed);
      }
    } catch (err) {
      console.error("Failed to generate and map conversational stream:", err);
    }
  };

  // If session is null, lock interface behind the Login Screen
  if (!session) {
    return (
      <div className="auth-wall-container">
        <div className="auth-card-wrapper">
          <div className="auth-branding">
            <Bot size={40} className="icon-emerald" />
            <h1>Nikoff Gateway</h1>
            <p>Authenticate to connect to the cloud model grid infrastructure.</p>
          </div>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#3b82f6',
                    brandAccent: '#2563eb',
                    inputBackground: '#020617',
                    inputText: '#f8fafc',
                    inputBorder: '#1e293b',
                    inputPlaceholder: '#64748b'
                  }
                }
              }
            }}
            theme="dark"
            providers={['google']}
          />
        </div>
      </div>
    );
  }

  // RENDER MAIN WORKSPACE ON SUCCESSFUL AUTH
  return (
    <div className="app-workspace">
      <aside className={`navigation-sidebar ${isSidebarOpen ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-top-action">
          <button className="new-chat-button" onClick={handleCreateNewChat}>
            <Plus size={18} />
            {isSidebarOpen && <span>New Chat</span>}
          </button>
          <button className="sidebar-toggle-inner" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {isSidebarOpen && (
          <div className="threads-history-container">
            <p className="history-section-heading">Recent Conversations</p>
            <div className="threads-list">
              {threads.map(thread => (
                <button
                  key={thread.id}
                  className={`thread-item-row ${currentThreadId === thread.id ? 'active-thread' : ''}`}
                  onClick={() => setCurrentThreadId(thread.id)}
                >
                  <MessageSquare size={16} />
                  <span className="thread-title-ellipsis">{thread.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isSidebarOpen && (
          <div className="user-profile-cabinet-footer">
            <div className="user-avatar-placeholder">
              {session.user?.email?.[0].toUpperCase()}
            </div>
            <div className="user-meta-info">
              <p className="profile-name">{session.user?.email}</p>
              <button className="logout-action-text-btn" onClick={() => supabase.auth.signOut()}>
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="chat-interface-stream-pane">
        <header className="workspace-top-navbar">
          {!isSidebarOpen && (
            <button className="sidebar-toggle-outer" onClick={() => setIsSidebarOpen(true)}>
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
            </div>

            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="model-selector-dropdown">
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

        <div className="chat-messages-scroll-area">
          {messages.length === 0 ? (
            <div className="empty-state-welcome">
              <Bot size={48} className="icon-subtle" />
              <h2>How can I assist your workflow today?</h2>
              <p>Select an LLM engine above to deploy complex processing arrays.</p>
            </div>
          ) : (
            (searchResults || messages).map((msg, index) => (
              <div key={msg.id || index} className={`message-bubble-wrapper ${msg.role === 'user' ? 'user-type' : 'ai-type'}`}>
                <div className="message-container-max-width">
                  <div className="author-avatar-badge">
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="message-body-content-text">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                  </div>
                </div>
                {msg.role === 'ai' && msg.id && (
                  <div className="feedback-actions">
                    <button
                      className={`feedback-btn ${msg.feedback?.rating === 1 ? 'active' : ''}`}
                      onClick={() => handleFeedback(msg.id!, 1)}
                      title="Good response"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      className={`feedback-btn ${msg.feedback?.rating === -1 ? 'active' : ''}`}
                      onClick={() => handleFeedback(msg.id!, -1)}
                      title="Bad response"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        <footer className="chat-input-sticky-footer">
          <form onSubmit={handleSubmit} className="chat-form-container-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder="Type a message..."
              rows={1}
              className="chat-textarea-box"
            />
            <button type="submit" className="message-submit-action-button" disabled={!input.trim()}>
              <Send size={16} />
            </button>
          </form>
        </footer>
      </main>

      <StatsDashboard />
    </div>
  );
}