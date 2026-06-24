import { useState, useCallback } from 'react';
import { consumeSSEStream } from '../utils/sseStream';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ChatMessage { id?: string; role: 'user' | 'ai'; text: string; image?: { data: string; mimeType: string } | null; audio?: { data: string; mimeType: string } | null; feedback?: { rating: number; comment?: string } | null; editedAt?: string | null; }

function updateMessagesWithAI(setMessages: any, aiText: string) {
  setMessages((prev: ChatMessage[]) => {
    const updated = [...prev];
    const lastIdx = updated.length - 1;
    if (updated[lastIdx]?.role === 'ai') {
      updated[lastIdx] = { ...updated[lastIdx], text: aiText };
    } else {
      updated.push({ role: 'ai', text: aiText });
    }
    return updated;
  });
}

export function useChat(_session: any, trackRequest: (i: number, o: number, t: number, ms: number, model: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const loadMessages = useCallback(async (token: string, threadId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/threads/${threadId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const sendMessage = useCallback(async (
    token: string,
    input: string,
    threadId: string | null,
    model: string,
    image?: { data: string; mimeType: string } | null,
    audio?: { data: string; mimeType: string } | null,
  ) => {
    const userMessage: ChatMessage = { role: 'user', text: input, image: image || undefined, audio: audio || undefined };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    const startTime = Date.now();
    setIsThinking(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages: updatedMessages, model, threadId })
      });

      if (!response.ok) return;

      let aiText = '';
      await consumeSSEStream(response, {
        onChunk: (_text, fullText) => {
          aiText = fullText;
          updateMessagesWithAI(setMessages, aiText);
        },
        onDone: (usage, modelUsed) => {
          const endTime = Date.now();
          if (usage) trackRequest(usage.promptTokens, usage.candidatesTokens, usage.totalTokens, endTime - startTime, modelUsed);
        },
      });
    } catch (err) {
      console.error('Stream failed:', err);
    } finally {
      setIsThinking(false);
    }
  }, [messages, trackRequest]);

  const editMessage = useCallback(async (token: string, messageId: string, content: string) => {
    try {
      const res = await fetch(`${API_URL}/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: data.content, editedAt: data.editedAt } : m));
      }
    } catch (err) {
      console.error('Edit failed:', err);
    }
  }, []);

  const sendFeedback = useCallback(async (token: string, messageId: string, rating: number) => {
    try {
      await fetch(`${API_URL}/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ rating })
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: { rating } } : m));
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  }, []);

  const regenerate = useCallback(async (token: string, messageId: string, threadId: string, model: string) => {
    setIsThinking(true);
    try {
      const response = await fetch(`${API_URL}/api/threads/${threadId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messageId, model })
      });

      if (!response.ok) return;

      let aiText = '';
      await consumeSSEStream(response, {
        onChunk: (_text, fullText) => {
          aiText = fullText;
          updateMessagesWithAI(setMessages, aiText);
        },
      });
    } catch (err) {
      console.error('Regenerate failed:', err);
    } finally {
      setIsThinking(false);
    }
  }, []);

  return { messages, setMessages, isThinking, loadMessages, sendMessage, editMessage, sendFeedback, regenerate };
}
