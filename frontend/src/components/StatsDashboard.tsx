import { useState } from 'react';
// THE FIX: We now import MODEL_CONFIGS instead of GEMINI_LIMITS
import { useStats, MODEL_CONFIGS } from '../context/StatsContext'; 
import { Activity, Zap, Clock, RotateCcw, Database, Filter } from 'lucide-react';

export const StatsDashboard = () => {
  const { stats, resetStats } = useStats();
  const [timeFilter, setTimeFilter] = useState<'all' | 'hour'>('all');

  const elapsedSeconds = Math.floor((Date.now() - stats.sessionStartTime) / 1000);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getDisplayStats = () => {
    if (timeFilter === 'all') return stats;
    
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentLogs = (stats.history || []).filter(log => log.timestamp >= oneHourAgo);
    
    const reqCount = recentLogs.length;
    const inTokens = recentLogs.reduce((sum, log) => sum + log.inputTokens, 0);
    const outTokens = recentLogs.reduce((sum, log) => sum + log.outputTokens, 0);
    const avgResp = reqCount > 0 
      ? recentLogs.reduce((sum, log) => sum + log.responseTimeMs, 0) / reqCount 
      : 0;

    return {
      ...stats,
      requestCount: reqCount,
      totalInputTokens: inTokens,
      totalOutputTokens: outTokens,
      averageResponseTime: avgResp
    };
  };

  const displayStats = getDisplayStats();

  // Dynamic Limit Matching Logic
  const lastLogEntry = stats.history && stats.history.length > 0 
    ? stats.history[stats.history.length - 1] 
    : null;

  const currentModel = lastLogEntry ? lastLogEntry.modelUsed : 'gemini-2.5-flash';

  // Read from our new MODEL_CONFIGS dictionary
  const activeConfig = MODEL_CONFIGS[currentModel] || MODEL_CONFIGS['default'];
  
  const contextPercentage = Math.min(
    (displayStats.currentContextTokens / activeConfig.maxContextTokens) * 100, 
    100
  );

  return (
    <div className="stats-sidebar">
      <div className="stats-header">
        <h2><Activity size={20} className="icon-emerald" /> Session Stats</h2>
        <button onClick={resetStats} className="icon-button" title="Reset Stats">
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="time-filter-container">
        <Filter size={14} className="icon-light" style={{ marginRight: '0.5rem' }} />
        <div className="time-toggle">
          <button 
            className={timeFilter === 'all' ? 'active' : ''} 
            onClick={() => setTimeFilter('all')}
          >All Time</button>
          <button 
            className={timeFilter === 'hour' ? 'active' : ''} 
            onClick={() => setTimeFilter('hour')}
          >Last Hour</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stats-card">
          <p className="stats-label"><Zap size={14} className="icon-yellow" /> Requests</p>
          <p className="stats-value">{displayStats.requestCount}</p>
          <p className="stats-subtext">{timeFilter === 'hour' ? 'In last 60 mins' : 'Free tier limits apply'}</p>
        </div>
        <div className="stats-card">
          <p className="stats-label"><Clock size={14} className="icon-blue" /> Resp. Time</p>
          <p className="stats-value">{(displayStats.lastResponseTime / 1000).toFixed(2)}s</p>
          <p className="stats-subtext">Avg: {(displayStats.averageResponseTime / 1000).toFixed(2)}s</p>
        </div>
      </div>

      <div className="stats-card">
        <div className="stats-row" style={{ marginBottom: '0.25rem' }}>
          <p className="stats-label" style={{ margin: 0 }}><Database size={14} className="icon-purple" /> Active Context</p>
          <span className="text-purple" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
            {displayStats.currentContextTokens.toLocaleString()} / {activeConfig.label}
          </span>
        </div>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${Math.max(contextPercentage, 1)}%` }} />
        </div>
      </div>

      <div className="stats-list">
        <div className="stats-row">
          <span>Input Tokens:</span>
          <span className="text-emerald">{displayStats.totalInputTokens.toLocaleString()}</span>
        </div>
        <div className="stats-row">
          <span>Output Tokens:</span>
          <span className="text-blue">{displayStats.totalOutputTokens.toLocaleString()}</span>
        </div>
        <div className="stats-row">
          <span>Session Active For:</span>
          <span className="text-light">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>
    </div>
  );
};