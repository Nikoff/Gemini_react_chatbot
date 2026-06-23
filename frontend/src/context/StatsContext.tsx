import React, { createContext, useContext, useState, useEffect } from 'react';

export interface RequestLog {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;
  modelUsed: string; // Tracks Gemma vs Gemini dynamically
}

export interface ChatSessionStats {
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  averageResponseTime: number;
  lastResponseTime: number;
  sessionStartTime: number;
  currentContextTokens: number;
  history: RequestLog[];
  modelRequests: Record<string, number>;
}

// THIS WAS THE MISSING PIECE! 
export const MODEL_CONFIGS: Record<string, { maxContextTokens: number; label: string }> = {
  'gemini-2.5-flash': { maxContextTokens: 1048576, label: '1M (Gemini 2.5)' },
  'gemini-2.5-flash-lite': { maxContextTokens: 1048576, label: '1M (Gemini 2.5 Lite)' },
  'gemini-2.0-flash': { maxContextTokens: 1048576, label: '1M (Gemini 2.0)' },
  'gemini-3.0-flash': { maxContextTokens: 1048576, label: '1M (Gemini 3.0)' },
  'gemini-3.1-flash-lite': { maxContextTokens: 1048576, label: '1M (Gemini 3.1 Lite)' },
  'gemini-3.5-flash': { maxContextTokens: 1048576, label: '1M (Gemini 3.5)' },
  'gemma-4-26b-a4b-it': { maxContextTokens: 256000, label: '256K (Gemma 4 26B)' },
  'gemma-4-31b-it': { maxContextTokens: 256000, label: '256K (Gemma 4 31B)' },
  'default': { maxContextTokens: 1048576, label: '1M' }
};

interface StatsContextType {
  stats: ChatSessionStats;
  trackRequest: (inputTokens: number, outputTokens: number, currentTokens: number, responseTimeMs: number, modelUsed: string) => void;
  resetStats: () => void;
  clearHistoryContext: () => void;
}

const initialStats: ChatSessionStats = {
  requestCount: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  averageResponseTime: 0,
  lastResponseTime: 0,
  sessionStartTime: Date.now(),
  currentContextTokens: 0,
  history: [],
  modelRequests: {},
};

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export const StatsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<ChatSessionStats>(() => {
    const saved = localStorage.getItem('gemini_chat_stats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...initialStats,
          ...parsed,
          sessionStartTime: parsed.sessionStartTime || Date.now(),
          currentContextTokens: parsed.currentContextTokens || 0,
          history: parsed.history || []
        };
      } catch (e) {
        return initialStats;
      }
    }
    return initialStats;
  });

  useEffect(() => {
    localStorage.setItem('gemini_chat_stats', JSON.stringify(stats));
  }, [stats]);

  const trackRequest = (inputTokens: number, outputTokens: number, currentTokens: number, responseTimeMs: number, modelUsed: string) => {
    setStats((prev) => {
      const newRequestCount = prev.requestCount + 1;
      const newAverageResponseTime =
        prev.averageResponseTime === 0
          ? responseTimeMs
          : (prev.averageResponseTime * prev.requestCount + responseTimeMs) / newRequestCount;

      const newLog: RequestLog = {
        timestamp: Date.now(),
        inputTokens,
        outputTokens,
        responseTimeMs,
        modelUsed
      };

      return {
        ...prev,
        requestCount: newRequestCount,
        totalInputTokens: prev.totalInputTokens + inputTokens,
        totalOutputTokens: prev.totalOutputTokens + outputTokens,
        currentContextTokens: currentTokens,
        lastResponseTime: responseTimeMs,
        averageResponseTime: Math.round(newAverageResponseTime),
        history: [...(prev.history || []), newLog],
        modelRequests: {
          ...prev.modelRequests,
          [modelUsed]: (prev.modelRequests?.[modelUsed] || 0) + 1,
        },
      };
    });
  };

  const clearHistoryContext = () => {
    setStats((prev) => ({ ...prev, currentContextTokens: 0 }));
  };

  const resetStats = () => {
    setStats({ ...initialStats, sessionStartTime: Date.now() });
  };

  return (
    <StatsContext.Provider value={{ stats, trackRequest, resetStats, clearHistoryContext }}>
      {children}
    </StatsContext.Provider>
  );
};

export const useStats = () => {
  const context = useContext(StatsContext);
  if (!context) throw new Error('useStats must be used within a StatsProvider');
  return context;
};