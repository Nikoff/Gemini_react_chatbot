import { useState, useEffect } from 'react';
import { useStats, MODEL_CONFIGS } from '../context/StatsContext';
import { useI18n } from '../context/I18nContext';
import { Activity, Zap, Clock, RotateCcw, Database, Filter, Cpu } from 'lucide-react';

export const StatsDashboard = () => {
  const { stats, resetStats } = useStats();
  const { t } = useI18n();
  const [timeFilter, setTimeFilter] = useState<'all' | 'hour'>('all');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

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

    const modelReqs: Record<string, number> = {};
    for (const log of recentLogs) {
      modelReqs[log.modelUsed] = (modelReqs[log.modelUsed] || 0) + 1;
    }

    return {
      ...stats,
      requestCount: reqCount,
      totalInputTokens: inTokens,
      totalOutputTokens: outTokens,
      averageResponseTime: avgResp,
      modelRequests: modelReqs,
    };
  };

  const displayStats = getDisplayStats();

  const lastLogEntry = stats.history && stats.history.length > 0
    ? stats.history[stats.history.length - 1]
    : null;

  const currentModel = lastLogEntry ? lastLogEntry.modelUsed : 'gemini-2.5-flash';
  const activeConfig = MODEL_CONFIGS[currentModel] || MODEL_CONFIGS['default'];

  const contextPercentage = Math.min(
    (displayStats.currentContextTokens / activeConfig.maxContextTokens) * 100,
    100
  );

  const modelEntries = Object.entries(displayStats.modelRequests || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="stats-sidebar">
      <div className="stats-header">
        <h2><Activity size={20} className="icon-emerald" /> {t('stats.title')}</h2>
        <button onClick={resetStats} className="icon-button" title={t('stats.reset')}>
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="stats-card" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <div className="stats-row" style={{ marginBottom: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#60a5fa' }}>
            <Cpu size={14} /> {t('stats.activeModel')}
          </span>
        </div>
        <p className="stats-value" style={{ fontSize: '1rem', color: '#f8fafc', marginTop: '0.25rem' }}>{currentModel}</p>
        <p className="stats-subtext">{activeConfig.label}</p>
      </div>

      <div className="time-filter-container">
        <Filter size={14} className="icon-light" style={{ marginRight: '0.5rem' }} />
        <div className="time-toggle">
          <button
            className={timeFilter === 'all' ? 'active' : ''}
            onClick={() => setTimeFilter('all')}
          >{t('stats.allTime')}</button>
          <button
            className={timeFilter === 'hour' ? 'active' : ''}
            onClick={() => setTimeFilter('hour')}
          >{t('stats.lastHour')}</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stats-card">
          <p className="stats-label"><Zap size={14} className="icon-yellow" /> {t('stats.requests')}</p>
          <p className="stats-value">{displayStats.requestCount}</p>
          <p className="stats-subtext">{timeFilter === 'hour' ? t('stats.requestsHour') : t('stats.requestsTotal')}</p>
        </div>
        <div className="stats-card">
          <p className="stats-label"><Clock size={14} className="icon-blue" /> {t('stats.respTime')}</p>
          <p className="stats-value">{(displayStats.lastResponseTime / 1000).toFixed(2)}s</p>
          <p className="stats-subtext">{t('stats.avg')} {(displayStats.averageResponseTime / 1000).toFixed(2)}s</p>
        </div>
      </div>

      {modelEntries.length > 0 && (
        <div className="stats-card">
          <p className="stats-label" style={{ marginBottom: '0.5rem' }}><Cpu size={14} className="icon-purple" /> {t('stats.perModel')}</p>
          {modelEntries.map(([model, count]) => (
            <div key={model} className="stats-row">
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model}</span>
              <span className="text-purple" style={{ fontWeight: 700, flexShrink: 0 }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="stats-card">
        <div className="stats-row" style={{ marginBottom: '0.25rem' }}>
          <p className="stats-label" style={{ margin: 0 }}><Database size={14} className="icon-purple" /> {t('stats.activeContext')}</p>
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
          <span>{t('stats.inputTokens')}</span>
          <span className="text-emerald">{displayStats.totalInputTokens.toLocaleString()}</span>
        </div>
        <div className="stats-row">
          <span>{t('stats.outputTokens')}</span>
          <span className="text-blue">{displayStats.totalOutputTokens.toLocaleString()}</span>
        </div>
        <div className="stats-row">
          <span>{t('stats.sessionFor')}</span>
          <span className="text-light">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>
    </div>
  );
};
