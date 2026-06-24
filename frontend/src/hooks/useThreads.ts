import { useState, useCallback } from 'react';
import { api } from '../utils/apiClient';

interface Thread { id: string; title: string; createdAt: string; }

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  const loadThreads = useCallback(async (token: string) => {
    try {
      const data = await api<Thread[] | { items: Thread[] }>(`/api/threads?limit=50`, { token });
      const items = Array.isArray(data) ? data : (data.items || []);
      if (items.length > 0) {
        setThreads(items);
        setCurrentThreadId(prev => prev ?? (items.length > 0 ? items[0].id : null));
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
    }
  }, []);

  const createThread = useCallback(async (token: string, title?: string) => {
    try {
      const newThread = await api<Thread>('/api/threads', {
        method: 'POST',
        body: { title: title || `Chat ${new Date().toLocaleDateString()}` },
        token,
      });
      setThreads(prev => [newThread, ...prev]);
      setCurrentThreadId(newThread.id);
      return newThread;
    } catch (err) {
      console.error('Failed to create thread:', err);
    }
  }, []);

  const deleteThread = useCallback(async (token: string, threadId: string) => {
    try {
      await api(`/api/threads/${threadId}`, {
        method: 'DELETE',
        token,
      });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  }, [currentThreadId]);

  const renameThread = useCallback(async (token: string, threadId: string, title: string) => {
    try {
      const data = await api<{ title: string }>(`/api/threads/${threadId}`, {
        method: 'PUT',
        body: { title },
        token,
      });
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: data.title } : t));
    } catch (err) {
      console.error('Failed to rename thread:', err);
    }
  }, []);

  return { threads, setThreads, currentThreadId, setCurrentThreadId, loadThreads, createThread, deleteThread, renameThread };
}
