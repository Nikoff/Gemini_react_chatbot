import { useState, useEffect } from 'react';
import { Bot, Play, Pause, CheckCircle, XCircle, Clock, Plus, X, Trash2, Cpu, Zap } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Agent {
  id: string;
  name: string;
  type: string;
  description: string | null;
  config: any;
  createdAt: string;
}

interface AgentRun {
  id: string;
  agentId: string;
  status: string;
  input: any;
  output: any;
  logs: { timestamp: string; level: string; message: string }[];
  creditsUsed: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  agent: { name: string; type: string };
}

const AGENT_TYPES = [
  { type: 'planner', label: 'Planner', icon: '\ud83c\udfaf', description: 'Decomposes tasks into subtasks' },
  { type: 'generator', label: 'Generator', icon: '\u2728', description: 'Generates content' },
  { type: 'editor', label: 'Editor', icon: '\u270f\ufe0f', description: 'Edits and improves content' },
  { type: 'qa', label: 'QA', icon: '\ud83d\udd0d', description: 'Quality assurance review' },
  { type: 'publisher', label: 'Publisher', icon: '\ud83d\udce4', description: 'Publishes final output' },
  { type: 'custom', label: 'Custom', icon: '\ud83e\udde9', description: 'Custom agent type' },
];

interface Props {
  session: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AgentDashboard({ session, isOpen, onClose }: Props) {
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeRuns, setActiveRuns] = useState<AgentRun[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [orchestrateInput, setOrchestrateInput] = useState('');
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [orchestrateResult, setOrchestrateResult] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', type: 'generator', description: '', model: 'gemini-2.5-flash' });

  useEffect(() => {
    if (isOpen && session) {
      loadAgents();
      loadActiveRuns();
    }
  }, [isOpen, session]);

  const loadAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) setAgents(await res.json());
    } catch {}
  };

  const loadActiveRuns = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents/runs/active`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) setActiveRuns(await res.json());
    } catch {}
  };

  const loadAgentRuns = async (agentId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/runs?limit=10`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) setAgentRuns(await res.json());
    } catch {}
  };

  const handleCreateAgent = async () => {
    if (!newAgent.name.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(newAgent),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewAgent({ name: '', type: 'generator', description: '', model: 'gemini-2.5-flash' });
        loadAgents();
      }
    } catch {}
  };

  const handleRunAgent = async (agentId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ input: { task: 'Execute agent task' } }),
      });

      if (res.ok) {
        loadActiveRuns();
        if (selectedAgent?.id === agentId) loadAgentRuns(agentId);
      }
    } catch {}
  };

  const handleOrchestrate = async () => {
    if (!orchestrateInput.trim() || isOrchestrating) return;

    setIsOrchestrating(true);
    setOrchestrateResult(null);

    try {
      const res = await fetch(`${API_URL}/api/agents/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ task: orchestrateInput.trim() }),
      });

      const data = await res.json();
      setOrchestrateResult(data);
    } catch (err) {
      setOrchestrateResult({ status: 'failed', error: 'Orchestration failed' });
    } finally {
      setIsOrchestrating(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await fetch(`${API_URL}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      loadAgents();
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
        setAgentRuns([]);
      }
    } catch {}
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="icon-emerald" />;
      case 'failed': return <XCircle size={14} className="icon-red" />;
      case 'running': return <Play size={14} className="icon-blue" />;
      case 'pending': return <Clock size={14} className="icon-yellow" />;
      default: return <Clock size={14} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="agent-dashboard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Bot size={20} /> Agent Dashboard</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="agent-layout">
          <div className="agent-sidebar">
            <div className="agent-sidebar-header">
              <span>Agents</span>
              <button className="wf-btn" onClick={() => setShowCreateModal(true)}>
                <Plus size={14} />
              </button>
            </div>

            {agents.length === 0 ? (
              <p className="agent-empty">No agents yet. Create one to get started.</p>
            ) : (
              <div className="agent-list">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`agent-item ${selectedAgent?.id === agent.id ? 'active' : ''}`}
                    onClick={() => { setSelectedAgent(agent); loadAgentRuns(agent.id); }}
                  >
                    <div className="agent-item-info">
                      <span className="agent-item-name">{agent.name}</span>
                      <span className="agent-item-type">{AGENT_TYPES.find(t => t.type === agent.type)?.icon} {agent.type}</span>
                    </div>
                    <div className="agent-item-actions">
                      <button className="wf-btn" onClick={(e) => { e.stopPropagation(); handleRunAgent(agent.id); }} title="Run">
                        <Play size={12} />
                      </button>
                      <button className="wf-btn wf-btn-delete" onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id); }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="agent-sidebar-section">
              <div className="agent-sidebar-header">
                <span><Cpu size={14} /> Orchestrate</span>
              </div>
              <textarea
                className="agent-textarea"
                value={orchestrateInput}
                onChange={(e) => setOrchestrateInput(e.target.value)}
                placeholder="Describe a complex task for multi-agent execution..."
                rows={3}
              />
              <button
                className="agent-orchestrate-btn"
                onClick={handleOrchestrate}
                disabled={isOrchestrating || !orchestrateInput.trim()}
              >
                {isOrchestrating ? <><Zap size={14} className="spin" /> Orchestrating...</> : <><Zap size={14} /> Run Orchestration</>}
              </button>
            </div>
          </div>

          <div className="agent-main">
            {selectedAgent ? (
              <>
                <div className="agent-detail-header">
                  <h3>{selectedAgent.name}</h3>
                  <span className={`agent-type-badge ${selectedAgent.type}`}>{selectedAgent.type}</span>
                  {selectedAgent.description && <p className="agent-desc">{selectedAgent.description}</p>}
                </div>

                <div className="agent-runs-list">
                  <h4>Recent Runs</h4>
                  {agentRuns.length === 0 ? (
                    <p className="agent-empty">No runs yet.</p>
                  ) : (
                    agentRuns.map((run) => (
                      <div key={run.id} className={`agent-run-item ${run.status}`}>
                        <div className="agent-run-header">
                          {getStatusIcon(run.status)}
                          <span className="agent-run-status">{run.status}</span>
                          <span className="agent-run-time">{new Date(run.startedAt).toLocaleString()}</span>
                          {run.creditsUsed > 0 && <span className="agent-run-credits">{run.creditsUsed} cr</span>}
                        </div>
                        {run.error && <p className="agent-run-error">{run.error}</p>}
                        {run.output && (
                          <div className="agent-run-output">
                            <pre>{JSON.stringify(run.output, null, 2).substring(0, 300)}...</pre>
                          </div>
                        )}
                        {run.logs && run.logs.length > 0 && (
                          <div className="agent-run-logs">
                            {run.logs.slice(-3).map((log, i) => (
                              <div key={i} className={`agent-log-entry ${log.level}`}>
                                <span className="agent-log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                {log.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="agent-main-empty">
                <Bot size={48} />
                <h3>Agent Dashboard</h3>
                <p>Select an agent to view details, or use Orchestrate to run multi-agent tasks.</p>

                {activeRuns.length > 0 && (
                  <div className="agent-active-runs">
                    <h4><Cpu size={14} /> Active Runs ({activeRuns.length})</h4>
                    {activeRuns.map((run) => (
                      <div key={run.id} className="agent-run-item running">
                        <div className="agent-run-header">
                          <Play size={14} className="icon-blue" />
                          <span>{run.agent.name}</span>
                          <span className="agent-run-time">Started {new Date(run.startedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {orchestrateResult && (
                  <div className="agent-orchestrate-result">
                    <h4><Zap size={14} /> Orchestration Result</h4>
                    <div className={`agent-orchestrate-status ${orchestrateResult.status}`}>
                      {orchestrateResult.status === 'completed' ? '\u2705 Completed' : '\u274c Failed'}
                    </div>
                    {orchestrateResult.plan && (
                      <div className="agent-plan">
                        {orchestrateResult.plan.map((task: any, i: number) => (
                          <div key={i} className="agent-plan-task">
                            <span className="agent-plan-title">{task.title}</span>
                            <span className="agent-plan-type">{task.agentType}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {orchestrateResult.results && (
                      <div className="agent-results">
                        {orchestrateResult.results.map((r: any, i: number) => (
                          <div key={i} className={`agent-result-item ${r.status}`}>
                            <span>Task {r.taskId}: {r.status}</span>
                            {r.error && <span className="agent-run-error">{r.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Agent</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <div className="gen-field">
              <label>Name</label>
              <input className="gen-input" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="My Agent" />
            </div>
            <div className="gen-field" style={{ marginTop: '0.75rem' }}>
              <label>Type</label>
              <div className="agent-type-grid">
                {AGENT_TYPES.map((at) => (
                  <button
                    key={at.type}
                    className={`agent-type-btn ${newAgent.type === at.type ? 'active' : ''}`}
                    onClick={() => setNewAgent({ ...newAgent, type: at.type })}
                  >
                    <span>{at.icon}</span>
                    <span>{at.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="gen-field" style={{ marginTop: '0.75rem' }}>
              <label>Description</label>
              <input className="gen-input" value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} placeholder="What does this agent do?" />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="modal-save" onClick={handleCreateAgent}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
