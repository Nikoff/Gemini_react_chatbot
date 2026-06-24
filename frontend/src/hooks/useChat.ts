import { useState, useCallback } from 'react';
import { consumeSSEStream } from '../utils/sseStream';
import { api, apiStream, APIError } from '../utils/apiClient';

interface ChatMessage { id?: string; role: 'user' | 'ai'; text: string; image?: { data: string; mimeType: string } | null; audio?: { data: string; mimeType: string } | null; feedback?: { rating: number; comment?: string } | null; editedAt?: string | null; }

function updateMessagesWithAI(setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, aiText: string) {
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

export function useChat(trackRequest: (i: number, o: number, t: number, ms: number, model: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const loadMessages = useCallback(async (token: string, threadId: string) => {
    try {
      const data = await api<ChatMessage[]>(`/api/threads/${threadId}/messages`, { token });
      if (Array.isArray(data)) setMessages(data);
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
      const response = await apiStream('/api/chat', {
        body: { messages: updatedMessages, model, threadId },
        token,
      });

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
      if (err instanceof APIError && err.status !== 200) return;
      console.error('Stream failed:', err);
    } finally {
      setIsThinking(false);
    }
  }, [messages, trackRequest]);

  const editMessage = useCallback(async (token: string, messageId: string, content: string) => {
    try {
      const data = await api<{ content: string; editedAt: string }>(`/api/messages/${messageId}`, {
        method: 'PUT',
        body: { content },
        token,
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: data.content, editedAt: data.editedAt } : m));
    } catch (err) {
      console.error('Edit failed:', err);
    }
  }, []);

  const sendFeedback = useCallback(async (token: string, messageId: string, rating: number) => {
    try {
      await api(`/api/messages/${messageId}/feedback`, {
        method: 'POST',
        body: { rating },
        token,
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: { rating } } : m));
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  }, []);

  const regenerate = useCallback(async (token: string, messageId: string, threadId: string, model: string) => {
    setIsThinking(true);
    try {
      const response = await apiStream(`/api/threads/${threadId}/regenerate`, {
        body: { messageId, model },
        token,
      });

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
