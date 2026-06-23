import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Thread { id: string; title: string; createdAt: string; }

export function useThreads(session: any) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  const loadThreads = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/api/threads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setThreads(data);
          if (data.length > 0 && !currentThreadId) {
            setCurrentThreadId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
    }
  }, [currentThreadId]);

  const createThread = useCallback(async (token: string, title?: string) => {
    try {
      const res = await fetch(`${API_URL}/api/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: title || `Chat ${new Date().toLocaleDateString()}` })
      });
      if (res.ok) {
        const newThread = await res.json();
        setThreads(prev => [newThread, ...prev]);
        setCurrentThreadId(newThread.id);
        return newThread;
      }
    } catch (err) {
      console.error('Failed to create thread:', err);
    }
  }, []);

  const deleteThread = useCallback(async (token: string, threadId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/threads/${threadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setThreads(prev => prev.filter(t => t.id !== threadId));
        if (currentThreadId === threadId) {
          setCurrentThreadId(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete thread:', err);
    }
  }, [currentThreadId]);

  const renameThread = useCallback(async (token: string, threadId: string, title: string) => {
    try {
      const res = await fetch(`${API_URL}/api/threads/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const data = await res.json();
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: data.title } : t));
      }
    } catch (err) {
      console.error('Failed to rename thread:', err);
    }
  }, []);

  return { threads, currentThreadId, setCurrentThreadId, loadThreads, createThread, deleteThread, renameThread };
}
