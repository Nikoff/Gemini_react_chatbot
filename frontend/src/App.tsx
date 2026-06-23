import { useState, useEffect, useRef } from 'react';
import { useStats } from './context/StatsContext';
import { useTheme } from './context/ThemeContext';
import { StatsDashboard } from './components/StatsDashboard';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { NeuralCanvas } from './components/NeuralCanvas';
import { BlackHoleCanvas } from './components/BlackHoleCanvas';
import { LivingCanvas } from './components/LivingCanvas';
import { AuthScreen } from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import { GenerationPanel } from './components/GenerationPanel';
import { WorkflowEditor } from './components/WorkflowEditor';
import { AgentDashboard } from './components/AgentDashboard';
import { MarketplaceBrowser } from './components/MarketplaceBrowser';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages } from './components/ChatMessages';
import { ChatInput } from './components/ChatInput';
import { useThreads } from './hooks/useThreads';
import { useChat } from './hooks/useChat';
import { useVoiceRecording } from './hooks/useVoiceRecording';
import { useImageUpload } from './hooks/useImageUpload';
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const { trackRequest } = useStats();
  const { theme } = useTheme();
  const [session, setSession] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 768);
  const [input, setInput] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showGeneration, setShowGeneration] = useState(false);
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [showAgentDashboard, setShowAgentDashboard] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { threads, currentThreadId, setCurrentThreadId, loadThreads, createThread, deleteThread, renameThread } = useThreads(session);
  const { messages, setMessages, isThinking, loadMessages, sendMessage, editMessage, sendFeedback, regenerate } = useChat(session, trackRequest);
  const { isRecording, pendingAudio, startRecording, stopRecording, clearAudio } = useVoiceRecording();
  const { pendingImage, fileInputRef, handleImageSelect, clearImage } = useImageUpload();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        loadThreads(session.access_token);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        loadThreads(session.access_token);
      } else {
        setSession(null);
        setThreads([]);
        setCurrentThreadId(null);
        setMessages([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentThreadId && session) loadMessages(session.access_token, currentThreadId);
  }, [currentThreadId, session]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isThinking]);

  const handleSubmit = () => {
    if (!input.trim() && !pendingImage && !pendingAudio) return;
    sendMessage(session.access_token, input, currentThreadId, selectedModel, pendingImage, pendingAudio);
    setInput('');
    clearImage();
    clearAudio();
  };

  const handleSystemPromptChange = async (threadId: string, prompt: string | null) => {
    if (!session) return;
    try {
      await fetch(`${API_URL}/api/threads/${threadId}/system-prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ systemPrompt: prompt })
      });
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, systemPrompt: prompt } : t));
    } catch (err) {
      console.error('Failed to update system prompt:', err);
    }
  };

  const handleCreateThread = async () => {
    if (!session) return;
    const thread = await createThread(session.access_token, `Chat ${new Date().toLocaleDateString()}`);
    if (thread) setMessages([]);
  };

  if (!session) {
    if (showAuth) return <AuthScreen />;
    return <LandingPage onLogin={() => setShowAuth(true)} />;
  }

  return (
    <div className="app-workspace">
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}
      <Sidebar
        threads={threads}
        currentThreadId={currentThreadId}
        isSidebarOpen={isSidebarOpen}
        session={session}
        onSelectThread={setCurrentThreadId}
        onCreateThread={handleCreateThread}
        onDeleteThread={(id) => deleteThread(session.access_token, id)}
        onRenameThread={(id, title) => renameThread(session.access_token, id, title)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onSystemPromptChange={handleSystemPromptChange}
        onOpenAdmin={() => setShowAdmin(true)}
      />

      <main className="chat-interface-stream-pane">
        <ChatHeader
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          currentThreadId={currentThreadId}
          session={session}
        />

        <ChatMessages
          messages={messages}
          isThinking={isThinking}
          onFeedback={(id, rating) => sendFeedback(session.access_token, id, rating)}
          onEdit={(id, text) => editMessage(session.access_token, id, text)}
          onRegenerate={(id) => regenerate(session.access_token, id, currentThreadId!, selectedModel)}
        />
        <div ref={chatEndRef} />

        <ChatInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          pendingImage={pendingImage}
          pendingAudio={pendingAudio}
          isRecording={isRecording}
          fileInputRef={fileInputRef}
          onImageSelect={handleImageSelect}
          onClearImage={clearImage}
          onClearAudio={clearAudio}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
        />
      </main>

      <StatsDashboard />
      {showAdmin && <AdminDashboard session={session} onClose={() => setShowAdmin(false)} />}
      <GenerationPanel session={session} isOpen={showGeneration} onClose={() => setShowGeneration(false)} />
      <WorkflowEditor session={session} isOpen={showWorkflowEditor} onClose={() => setShowWorkflowEditor(false)} />
      <AgentDashboard session={session} isOpen={showAgentDashboard} onClose={() => setShowAgentDashboard(false)} />
      <MarketplaceBrowser session={session} isOpen={showMarketplace} onClose={() => setShowMarketplace(false)} />
      {theme === 'living-canvas' && <LivingCanvas />}
      {theme === 'neural' && <NeuralCanvas />}
      {theme === 'blackhole' && <BlackHoleCanvas />}
      <ThemeSwitcher onOpenGeneration={() => setShowGeneration(true)} onOpenWorkflowEditor={() => setShowWorkflowEditor(true)} onOpenAgentDashboard={() => setShowAgentDashboard(true)} onOpenMarketplace={() => setShowMarketplace(true)} />
    </div>
  );
}
