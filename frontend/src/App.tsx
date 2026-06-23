import { useState, useEffect, useRef } from 'react';
import { useStats } from './context/StatsContext';
import { useTheme } from './context/ThemeContext';
import { StatsDashboard } from './components/StatsDashboard';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { NeuralCanvas } from './components/NeuralCanvas';
import { BlackHoleCanvas } from './components/BlackHoleCanvas';
import { LivingCanvas } from './components/LivingCanvas';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages } from './components/ChatMessages';
import { ChatInput } from './components/ChatInput';
import { useThreads } from './hooks/useThreads';
import { useChat } from './hooks/useChat';
import { useVoiceRecording } from './hooks/useVoiceRecording';
import { useImageUpload } from './hooks/useImageUpload';
import { supabase } from './supabaseClient';

export default function App() {
  const { trackRequest } = useStats();
  const { theme } = useTheme();
  const [session, setSession] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { threads, currentThreadId, setCurrentThreadId, loadThreads, createThread, deleteThread, renameThread } = useThreads(session);
  const { messages, setMessages, isThinking, loadMessages, sendMessage, editMessage, sendFeedback } = useChat(session, trackRequest);
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

  const handleCreateThread = async () => {
    if (!session) return;
    const thread = await createThread(session.access_token, `Chat ${new Date().toLocaleDateString()}`);
    if (thread) setMessages([]);
  };

  if (!session) return <AuthScreen />;

  return (
    <div className="app-workspace">
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
      {theme === 'living-canvas' && <LivingCanvas />}
      {theme === 'neural' && <NeuralCanvas />}
      {theme === 'blackhole' && <BlackHoleCanvas />}
      <ThemeSwitcher />
    </div>
  );
}
