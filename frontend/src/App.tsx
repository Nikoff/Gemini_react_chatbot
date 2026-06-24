import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
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
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages } from './components/ChatMessages';
import { ChatInput } from './components/ChatInput';
import { useThreads } from './hooks/useThreads';
import { useChat } from './hooks/useChat';
import { useVoiceRecording } from './hooks/useVoiceRecording';
import { useImageUpload } from './hooks/useImageUpload';
import { usePanelState } from './hooks/usePanelState';
import { supabase } from './supabaseClient';
import { api } from './utils/apiClient';

export default function App() {
  const { trackRequest } = useStats();
  const { theme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 768);
  const [input, setInput] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarding_complete'));
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { activePanel, openPanel, closePanel } = usePanelState();

  const { threads, setThreads, currentThreadId, setCurrentThreadId, loadThreads, createThread, deleteThread, renameThread } = useThreads();
  const { messages, setMessages, isThinking, loadMessages, sendMessage, editMessage, sendFeedback, regenerate } = useChat(trackRequest);
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
    sendMessage(session!.access_token, input, currentThreadId, selectedModel, pendingImage, pendingAudio);
    setInput('');
    clearImage();
    clearAudio();
  };

  const handleSystemPromptChange = async (threadId: string, prompt: string | null) => {
    if (!session) return;
    try {
      await api(`/api/threads/${threadId}/system-prompt`, {
        method: 'PUT',
        body: { systemPrompt: prompt },
        token: session.access_token,
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
    if (activePanel === 'auth') return <AuthScreen />;
    return <LandingPage onLogin={() => openPanel('auth')} />;
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
        onOpenAdmin={() => openPanel('admin')}
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
      <PanelErrorBoundary name="Admin">
        {activePanel === 'admin' && <AdminDashboard session={session} onClose={closePanel} />}
      </PanelErrorBoundary>
      <PanelErrorBoundary name="Generation">
        <GenerationPanel session={session} isOpen={activePanel === 'generation'} onClose={closePanel} />
      </PanelErrorBoundary>
      <PanelErrorBoundary name="Workflow Editor">
        <WorkflowEditor session={session} isOpen={activePanel === 'workflow'} onClose={closePanel} />
      </PanelErrorBoundary>
      <PanelErrorBoundary name="Agent Dashboard">
        <AgentDashboard session={session} isOpen={activePanel === 'agents'} onClose={closePanel} />
      </PanelErrorBoundary>
      <PanelErrorBoundary name="Marketplace">
        <MarketplaceBrowser session={session} isOpen={activePanel === 'marketplace'} onClose={closePanel} />
      </PanelErrorBoundary>
      {theme === 'living-canvas' && <LivingCanvas />}
      {theme === 'neural' && <NeuralCanvas />}
      {theme === 'blackhole' && <BlackHoleCanvas />}
      <ThemeSwitcher onOpenGeneration={() => openPanel('generation')} onOpenWorkflowEditor={() => openPanel('workflow')} onOpenAgentDashboard={() => openPanel('agents')} onOpenMarketplace={() => openPanel('marketplace')} />
      <OnboardingTutorial isOpen={showOnboarding} onClose={() => { setShowOnboarding(false); localStorage.setItem('onboarding_complete', '1'); }} />
    </div>
  );
}
